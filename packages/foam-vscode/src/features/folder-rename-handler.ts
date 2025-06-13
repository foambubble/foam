import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { MarkdownLink } from '../core/services/markdown-link';
import { Logger } from '../core/utils/log';
import { isAbsolute } from '../core/utils/path';
import { getFoamVsCodeConfig } from '../services/config';
import { fromVsCodeUri, toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';

interface FolderRenameResult {
	filesProcessed: number;
	linksUpdated: number;
	errors: string[];
	warnings: string[];
}

interface FolderRenameOptions {
	showProgress?: boolean;
	confirmAction?: boolean;
	maxFilesToProcess?: number;
}

/**
 * Handles folder renames with comprehensive link updates
 */
export class FolderRenameHandler {
	private foam: Foam;

	constructor(foam: Foam) {
		this.foam = foam;
	}
	/**
	 * Main entry point for handling folder rename events
	 */
	async handleFolderRename(
		oldUri: vscode.Uri,
		newUri: vscode.Uri,
		options: FolderRenameOptions = {}
	): Promise<FolderRenameResult> {
		const result: FolderRenameResult = {
			filesProcessed: 0,
			linksUpdated: 0,
			errors: [],
			warnings: []
		};

		const originalLoggerError = Logger.error;
		const oldPathPrefix = fromVsCodeUri(oldUri).path;
		let suppressedErrorCount = 0;

		Logger.info(`Starting rename from "${vscode.workspace.asRelativePath(oldUri)}" to "${vscode.workspace.asRelativePath(newUri)}".`);

		Logger.error = (message: any, ...params: any[]) => {
			let fullMessage = String(message);
			if (
				typeof fullMessage === 'string' &&
				fullMessage.startsWith('FileDataStore: error while reading uri:')
			) {
				const pathPartRegex = /FileDataStore: error while reading uri: (.*?)\s+-/;
				const pathMatch = fullMessage.match(pathPartRegex);
				const erroredPath = pathMatch && pathMatch[1] ? pathMatch[1].trim() : null;

				if (
					erroredPath &&
					erroredPath.startsWith(oldPathPrefix) &&
					(fullMessage.includes('ENOENT') || fullMessage.includes('EntryNotFound'))
				) {
					suppressedErrorCount++;
					Logger.debug(
						`Suppressed expected FileDataStore error for old path: ${fullMessage}`
					);
					return;
				}
			}
			originalLoggerError(message, ...params);
		};

		try {
			// Get configuration settings
			const mode = getFoamVsCodeConfig<string>('links.folderRename.mode', 'ask');
			const maxFiles = getFoamVsCodeConfig<number>('links.folderRename.maxFiles', 500);
			const showProgress = getFoamVsCodeConfig<boolean>('links.folderRename.showProgress', true);

			if (mode === 'never') {
				Logger.info('Link updates disabled by user configuration.');
				return result;
			}

			const markdownFilesInFolder = await this.discoverMarkdownFiles(oldUri);
			if (markdownFilesInFolder.length === 0) {
				Logger.info(`No markdown files found in renamed folder: ${vscode.workspace.asRelativePath(oldUri)}`);
				return result;
			}
			Logger.info(`Found ${markdownFilesInFolder.length} markdown files in "${vscode.workspace.asRelativePath(oldUri)}".`);

			if (markdownFilesInFolder.length > maxFiles) {
				const message = `Folder contains ${markdownFilesInFolder.length} files, exceeding limit of ${maxFiles}. Link updates will be skipped.`;
				result.warnings.push(message);
				vscode.window.showWarningMessage(`Foam: ${message}`);
				return result;
			}

			if (mode === 'ask' || options.confirmAction) {
				const action = await this.askUserConfirmation(markdownFilesInFolder.length, oldUri, newUri);
				if (action !== 'proceed') {
					Logger.info('User declined folder rename link updates.');
					return result;
				}
			}

			// Perform the link updates
			const linkUpdateOpResult = await this.updateLinksForFolderRename(
				oldUri,
				newUri,
				markdownFilesInFolder,
				{ ...options, showProgress }
			);
			result.filesProcessed += linkUpdateOpResult.filesProcessed;
			result.linksUpdated += linkUpdateOpResult.linksUpdated;
			result.errors.push(...linkUpdateOpResult.errors);
			result.warnings.push(...linkUpdateOpResult.warnings);

			Logger.info('Refreshing Foam workspace, graph, and matcher...');
			try {
				const oldFolderPath = fromVsCodeUri(oldUri).path;
				const newFolderPath = fromVsCodeUri(newUri).path;

				const resourcesToRemove = this.foam.workspace.list().filter(resource => {
					return resource.uri.path.startsWith(oldFolderPath + '/') || resource.uri.path === oldFolderPath;
				});
				if (resourcesToRemove.length > 0) {
					Logger.info(`Removing ${resourcesToRemove.length} old resource(s) from workspace.`);
				}
				for (const resource of resourcesToRemove) {
					try {
						this.foam.workspace.delete(resource.uri);
						Logger.debug(`Removed old file URI from workspace: ${resource.uri.path}`);
					} catch (deleteError) {
						Logger.warn(`Failed to remove old file URI ${resource.uri.path} from workspace:`, deleteError);
					}
				}

				Logger.debug('Refreshing Foam matcher...');
				await this.foam.services.matcher.refresh();

				Logger.debug('Re-adding files under new path to workspace...');
				const dataStoreFiles = await this.foam.services.dataStore.list();
				const newFilesToAdd = dataStoreFiles.filter(uri =>
					uri.path.startsWith(newFolderPath + '/') || uri.path === newFolderPath
				);
				if (newFilesToAdd.length > 0) {
					Logger.info(`Adding ${newFilesToAdd.length} new resource(s) to workspace.`);
				}
				for (const fileUri of newFilesToAdd) {
					try {
						await this.foam.workspace.fetchAndSet(fileUri);
						Logger.debug(`Added new file URI to workspace: ${fileUri.path}`);
					} catch (addError) {
						Logger.warn(`Failed to add new file URI ${fileUri.path} to workspace:`, addError);
					}
				}

				Logger.debug('Updating graph...');
				await this.foam.graph.update();

				await new Promise(resolve => setTimeout(resolve, 100));

				Logger.info('Foam workspace, graph, and matcher refreshed successfully.');
			} catch (refreshError) {
				const refreshErrorMessage = `Failed to refresh Foam workspace components: ${refreshError}`;
				Logger.warn(`${refreshErrorMessage}`, refreshError);
				result.warnings.push('Cache refresh failed - some links may appear broken until VS Code restart or manual Foam rescan.');
			}

			if (suppressedErrorCount > 0) {
				Logger.debug(`Suppressed ${suppressedErrorCount} expected FileDataStore errors during the rename operation.`);
			}
			Logger.info(`Successfully completed rename operation from "${vscode.workspace.asRelativePath(oldUri)}" to "${vscode.workspace.asRelativePath(newUri)}".`);
			return result;

		} catch (error) {
			const errorMessage = `Critical error during folder rename from ${oldUri.path} to ${newUri.path}: ${error}`;
			result.errors.push(String(error)); // Ensure error is string
			// Use originalLoggerError here to ensure critical failures are always logged unfiltered
			originalLoggerError(errorMessage, error);
			return result;
		} finally {
			Logger.error = originalLoggerError;
			Logger.debug('Restored original Logger.error.');
		}
	}

	/**
	 * Discovers all markdown files recursively in a folder
	 */
	private async discoverMarkdownFiles(folderUri: vscode.Uri): Promise<vscode.Uri[]> {
		const markdownFiles: vscode.Uri[] = [];
		const markdownExtensions = ['.md', '.markdown', '.mdx', '.mdown', '.mkdn', '.mkd', '.mdwn', '.mdtxt', '.mdtext', '.text', '.rmd'];

		const scanDirectory = async (dirUri: vscode.Uri): Promise<void> => {
			try {
				const entries = await vscode.workspace.fs.readDirectory(dirUri);

				for (const [name, type] of entries) {
					const entryUri = vscode.Uri.joinPath(dirUri, name);

					if (type === vscode.FileType.Directory) {
						await scanDirectory(entryUri);
					} else if (type === vscode.FileType.File) {
						const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
						if (markdownExtensions.includes(ext)) {
							markdownFiles.push(entryUri);
						}
					}
				}
			} catch (error) {
				Logger.warn(`Failed to scan directory ${dirUri.fsPath}:`, error);
			}
		};

		await scanDirectory(folderUri);
		return markdownFiles;
	}

	/**
	 * Calculates the new URI for a file after folder rename
	 */
	private calculateNewFileUri(
		fileUri: vscode.Uri,
		oldFolderUri: vscode.Uri,
		newFolderUri: vscode.Uri
	): vscode.Uri {
		// Calculate relative path from old folder to file
		const oldFolderPath = oldFolderUri.fsPath.replace(/\\/g, '/');
		const filePath = fileUri.fsPath.replace(/\\/g, '/');

		if (!filePath.startsWith(oldFolderPath)) {
			throw new Error(`File ${filePath} is not within folder ${oldFolderPath}`);
		}

		const relativePath = filePath.substring(oldFolderPath.length);
		const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;

		return vscode.Uri.joinPath(newFolderUri, cleanRelativePath);
	}

	/**
	 * Asks user for confirmation before proceeding with folder rename
	 */
	private async askUserConfirmation(
		fileCount: number,
		oldUri: vscode.Uri,
		newUri: vscode.Uri
	): Promise<'proceed' | 'cancel'> {
		const oldPath = vscode.workspace.asRelativePath(oldUri);
		const newPath = vscode.workspace.asRelativePath(newUri);

		const message = `Update links in ${fileCount} markdown files when renaming folder from '${oldPath}' to '${newPath}'?`;
		const action = await vscode.window.showInformationMessage(
			message,
			{ modal: true },
			'Update Links',
			'Skip Updates'
		);

		return action === 'Update Links' ? 'proceed' : 'cancel';
	}

	/**
	 * Performs the actual link updates for all files affected by folder rename
	 */
	private async updateLinksForFolderRename(
		oldFolderUri: vscode.Uri,
		newFolderUri: vscode.Uri,
		markdownFiles: vscode.Uri[],
		options: FolderRenameOptions
	): Promise<FolderRenameResult> {
		const result: FolderRenameResult = {
			filesProcessed: 0,
			linksUpdated: 0,
			errors: [],
			warnings: []
		};

		const renameEdits = new vscode.WorkspaceEdit();
		let progress: vscode.Progress<{ message?: string; increment?: number }> | undefined;

		try {
			// Setup progress reporting
			if (options.showProgress) {
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'Updating links for folder rename',
						cancellable: false
					},
					async (progressReporter) => {
						progress = progressReporter;
						return this.processFilesForLinkUpdates(
							oldFolderUri,
							newFolderUri,
							markdownFiles,
							renameEdits,
							result,
							progress
						);
					}
				);
			} else {
				await this.processFilesForLinkUpdates(
					oldFolderUri,
					newFolderUri,
					markdownFiles,
					renameEdits,
					result
				);
			}

			// Apply all edits
			if (renameEdits.size > 0) {
				await this.applyWorkspaceEdits(renameEdits, result);
			}

		} catch (error) {
			const errorMessage = `Error during link updates: ${error}`;
			result.errors.push(errorMessage);
			Logger.error(errorMessage, error);
		}

		return result;
	}
	/**
	 * Processes all files to find and update links affected by folder rename
	 */
	private async processFilesForLinkUpdates(
		oldFolderUri: vscode.Uri,
		newFolderUri: vscode.Uri,
		markdownFiles: vscode.Uri[],
		renameEdits: vscode.WorkspaceEdit,
		result: FolderRenameResult,
		progress?: vscode.Progress<{ message?: string; increment?: number }>
	): Promise<void> {
		const increment = 100 / markdownFiles.length;

		Logger.info(`Processing ${markdownFiles.length} file(s) for link updates...`);

		for (const [index, oldFileUri] of markdownFiles.entries()) {
			try {
				if (progress) {
					const fileName = vscode.workspace.asRelativePath(oldFileUri);
					progress.report({
						message: `Processing ${fileName}...`,
						increment: index === 0 ? 0 : increment
					});
				}

				const newFileUri = this.calculateNewFileUri(oldFileUri, oldFolderUri, newFolderUri);

				Logger.debug(`Checking backlinks for: ${vscode.workspace.asRelativePath(oldFileUri)} (new: ${vscode.workspace.asRelativePath(newFileUri)})`);

				// Find all links that point to this file (from Foam's knowledge graph)
				const connections = this.foam.graph.getBacklinks(fromVsCodeUri(oldFileUri));

				if (connections.length > 0) {
					Logger.debug(`Found ${connections.length} backlinks to ${vscode.workspace.asRelativePath(oldFileUri)}`);
				}
				for (const connection of connections) {
					const { target } = MarkdownLink.analyzeLink(connection.link);
					const sourceFileUri = toVsCodeUri(connection.source);
					const sourceFile = vscode.workspace.asRelativePath(sourceFileUri);

					Logger.debug(`Updating link in "${sourceFile}": "${connection.link.rawText}"`);

					// Check if the source file is also within the renamed folder
					let actualSourceUri = sourceFileUri;
					const oldFolderPath = oldFolderUri.fsPath.replace(/\\/g, '/');
					const sourceFilePath = sourceFileUri.fsPath.replace(/\\/g, '/');

					if (sourceFilePath.startsWith(oldFolderPath)) {
						// Source file is also in the renamed folder, so calculate its new path
						actualSourceUri = this.calculateNewFileUri(sourceFileUri, oldFolderUri, newFolderUri);
						Logger.debug(`  → Source file also moved to: ${vscode.workspace.asRelativePath(actualSourceUri)}`);
					}

					switch (connection.link.type) {
						case 'wikilink': {
							// Calculate the new relative path for wikilinks
							let newTarget: string;

							if (connection.link.rawText.includes('/')) {
								// For path-based wikilinks like [[folder/file]], update the folder part
								const relativePath = vscode.workspace.asRelativePath(newFileUri);
								newTarget = relativePath.replace(/\\/g, '/');
								// Remove .md extension for wikilinks
								if (newTarget.endsWith('.md')) {
									newTarget = newTarget.slice(0, -3);
								}
							} else {
								// For simple wikilinks like [[file]], keep just the filename
								const fileName = newFileUri.path.split('/').pop() || '';
								newTarget = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
							}

							const edit = MarkdownLink.createUpdateLinkEdit(connection.link, {
								target: newTarget,
							});
							renameEdits.replace(
								actualSourceUri,  // Use the correct (possibly updated) source path
								toVsCodeRange(edit.range),
								edit.newText
							);
							result.linksUpdated++;
							Logger.debug(`  → Wikilink in "${sourceFile}" updated to: "${edit.newText}"`);
							break;
						}
						case 'link': {
							const path = isAbsolute(target)
								? '/' + vscode.workspace.asRelativePath(newFileUri)
								: fromVsCodeUri(newFileUri).relativeTo(
									connection.source.getDirectory()
								).path;
							const edit = MarkdownLink.createUpdateLinkEdit(connection.link, {
								target: path,
							}); renameEdits.replace(
								actualSourceUri,  // Use the correct (possibly updated) source path
								toVsCodeRange(edit.range),
								edit.newText
							);
							result.linksUpdated++;
							Logger.debug(`  → Markdown link in "${sourceFile}" updated to: "${edit.newText}"`);
							break;
						}
					}
				}

				result.filesProcessed++;

			} catch (error) {
				const errorMessage = `Failed to process file ${oldFileUri.fsPath}: ${error}`;
				result.errors.push(errorMessage);
				Logger.error(errorMessage, error);
			}
		}

		Logger.info(`Finished processing files. Found ${result.linksUpdated} link(s) to update across ${renameEdits.size} file(s).`);
	}

	/**
	 * Applies workspace edits with proper error handling
	 */
	private async applyWorkspaceEdits(
		renameEdits: vscode.WorkspaceEdit,
		result: FolderRenameResult
	): Promise<void> {
		try {
			const successfulEditsPaths: string[] = []; // Store paths for debug logging

			// We break the update by file because applying it at once was causing
			// dirty state and editors not always saving or closing
			for (const [uri, edits] of renameEdits.entries()) {
				try {
					// Check if the file exists before trying to edit it
					try {
						await vscode.workspace.fs.stat(uri);
					} catch (statError) {
						Logger.warn(`Skipping edits for non-existent file: ${uri.fsPath}`);
						result.warnings.push(`File not found, skipping link updates: ${uri.fsPath}`);
						continue;
					}

					const fileEdits = new vscode.WorkspaceEdit();
					fileEdits.set(uri, edits);

					const success = await vscode.workspace.applyEdit(fileEdits);
					if (!success) {
						const warningMessage = `Failed to apply edits to ${uri.fsPath}: Workspace edit was rejected`;
						result.warnings.push(warningMessage);
						Logger.warn(warningMessage);
						continue;
					}

					// Try to open and save the document
					try {
						const document = await vscode.workspace.openTextDocument(uri);
						await document.save();
						successfulEditsPaths.push(vscode.workspace.asRelativePath(uri));
					} catch (saveError) {
						const warningMessage = `Applied edits but failed to save ${uri.fsPath}: ${saveError}`;
						result.warnings.push(warningMessage);
						Logger.warn(warningMessage);
						// Still count as successful since the edit was applied
						successfulEditsPaths.push(vscode.workspace.asRelativePath(uri));
					}

				} catch (error) {
					const errorMessage = `Failed to apply edits to ${uri.fsPath}: ${error}`;
					result.errors.push(errorMessage);
					Logger.error(errorMessage, error);
				}
			}

			if (successfulEditsPaths.length > 0) {
				Logger.debug(
					`Successfully applied edits to the following files:`,
					successfulEditsPaths
				);

				let message = `Updated ${result.linksUpdated} link(s) across ${successfulEditsPaths.length} file(s).`;
				if (result.warnings.length > 0) {
					message += ` (${result.warnings.length} warnings - check logs for details)`;
				}

				vscode.window.showInformationMessage(message);
			} else if (result.linksUpdated > 0) {
				vscode.window.showWarningMessage(
					`Found ${result.linksUpdated} links to update but could not apply changes to any files. Check logs for details.`
				);
			}

		} catch (error) {
			const errorMessage = `Failed to apply workspace edits: ${error}`;
			result.errors.push(errorMessage);
			Logger.error(errorMessage, error);
			throw error;
		}
	}
}
