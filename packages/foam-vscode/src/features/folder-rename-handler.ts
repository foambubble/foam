import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { MarkdownLink } from '../core/services/markdown-link';
import { Logger } from '../core/utils/log';
import { isAbsolute, getDirectory, relativeTo } from '../core/utils/path';
import { getFoamVsCodeConfig } from '../services/config';
import { fromVsCodeUri, toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';
import { FolderRenameDialog, DryRunCalculationResult, FolderRenameDialogResult } from './folder-rename-dialog';
import * as path from 'path';

interface FolderRenameResult {
	filesProcessed: number;
	linksUpdated: number;
	errors: string[];
	warnings: string[];
}

interface FolderRenameOptions {
	confirmAction?: boolean;
}

interface ProcessFilesInternalResult {
	linksUpdatedCount: number;
	filesProcessedCount: number;
	calculationErrors: string[];
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
			// const showProgress = getFoamVsCodeConfig<boolean>('links.folderRename.showProgress', true); // Removed as unused			// This variable will store the user's decision from the dialog, if shown.
			let userDecision: FolderRenameDialogResult | undefined;
			if (mode === 'never') {
				Logger.info('Link updates disabled by user configuration (mode: never). Foam will only refresh workspace data.');
				// No userDecision needed, proceed to cache refresh, skip link updates.
				// To achieve this, we can simulate a 'skip' action internally.
				userDecision = { action: 'skip' };
			}

			const markdownFilesInFolder = this.discoverMarkdownFiles(oldUri);
			if (markdownFilesInFolder.length === 0) {
				Logger.info(`No markdown files found in renamed folder: ${vscode.workspace.asRelativePath(oldUri)}`);
				return result;
			}
			Logger.debug(`Found ${markdownFilesInFolder.length} markdown files in "${vscode.workspace.asRelativePath(oldUri)}".`);

			if (markdownFilesInFolder.length > maxFiles) {
				const message = `Folder contains ${markdownFilesInFolder.length} files, exceeding limit of ${maxFiles}. Link updates will be skipped.`;
				result.warnings.push(message);
				vscode.window.showWarningMessage(`Foam: ${message}`);
				return result;
			}

			Logger.debug('Starting dry run calculation for link updates...');
			let dryRunCalcResult: DryRunCalculationResult | undefined;
			try {
				dryRunCalcResult = await this.calculateLinkUpdateEdits(
					oldUri,
					newUri,
					markdownFilesInFolder
				);
				Logger.debug(`Dry run complete: ${dryRunCalcResult.linksUpdatedCount} potential links in ${dryRunCalcResult.filesToEditCount} files.`);
				if (dryRunCalcResult.calculationErrors.length > 0) {
					Logger.warn('Dry run encountered errors:', dryRunCalcResult.calculationErrors.join('\n'));
					result.warnings.push(...dryRunCalcResult.calculationErrors.map(e => `Dry run: ${e}`));
				}
			} catch (dryRunError) {
				Logger.error('Critical error during dry run calculation:', dryRunError);
				result.errors.push(`Critical dry run error: ${dryRunError}`);
			} if (mode === 'always' && !options.confirmAction) {
				Logger.debug("Mode is 'always', proceeding with link updates automatically.");
				userDecision = { action: 'proceed' }; // Simulate proceed for automatic application
			} else if (mode !== 'never') { // This covers 'ask' or ('always' with confirmAction)
				// If mode is 'never', userDecision is already set to skip, and this block is skipped.
				userDecision = await FolderRenameDialog.show(
					markdownFilesInFolder.length,
					oldUri,
					newUri, dryRunCalcResult,
					mode // Pass the current mode
				); if (userDecision.action === 'settings') {
					Logger.debug('User chose to open settings for folder rename behavior. Aborting the current rename operation.');
					// Open VS Code settings and search for the foam folder rename setting
					await vscode.commands.executeCommand('workbench.action.openSettings', 'foam.links.folderRename');

					// Abort the current rename operation by reverting the folder
					try {
						await this.revertFolderRename(newUri, oldUri);
						vscode.window.showInformationMessage(
							`Folder rename aborted while you browse settings. Reverted '${vscode.workspace.asRelativePath(newUri)}' back to '${vscode.workspace.asRelativePath(oldUri)}'. ` +
							`You can rename the folder again after adjusting your settings.`
						);
						return result;
					} catch (revertError) {
						Logger.error('Failed to revert folder rename after opening settings:', revertError);
						result.errors.push(`Failed to revert folder rename after opening settings: ${revertError}`);
						vscode.window.showErrorMessage(`Failed to revert folder rename: ${revertError}. You can change folder rename behavior in the Foam settings that just opened.`);
						return result;
					}
				}

				if (userDecision.action === 'abort') {
					Logger.debug('User chose to abort the folder rename operation.');
					// Attempt to revert the folder rename
					try {
						await this.revertFolderRename(newUri, oldUri);
						vscode.window.showInformationMessage(`Folder rename aborted. Reverted '${vscode.workspace.asRelativePath(newUri)}' back to '${vscode.workspace.asRelativePath(oldUri)}'.`);
						return result;
					} catch (revertError) {
						Logger.error('Failed to revert folder rename:', revertError);
						result.errors.push(`Failed to revert folder rename: ${revertError}`);
						vscode.window.showErrorMessage(`Failed to revert folder rename: ${revertError}`);
						return result;
					}
				}
			}

			// Action based on userDecision (or pre-set decision for 'never'/'always' modes)
			if (userDecision?.action === 'cancel') {
				Logger.debug('User aborted Foam link update operation for this folder rename.');
				vscode.window.showWarningMessage('Folder rename has occurred, but Foam link updates and immediate cache processing were aborted by user.');
				return result; // Return early, no link updates or cache refresh needed from our side for this specific event
			} else if (userDecision?.action === 'skip') {
				Logger.debug('Skipping link updates for this folder rename.');
				// Edits are not applied. Cache refresh will still happen below.
				if (dryRunCalcResult) { // Update filesProcessed even if skipping
					result.filesProcessed = dryRunCalcResult.filesProcessedCount;
				}
			} else if (userDecision?.action === 'proceed') {
				if (dryRunCalcResult && dryRunCalcResult.edits.size > 0) {
					Logger.debug(`Applying ${dryRunCalcResult.linksUpdatedCount} calculated link updates across ${dryRunCalcResult.filesToEditCount} file(s).`);
					await this.applyWorkspaceEdits(dryRunCalcResult.edits, result);
					result.filesProcessed = dryRunCalcResult.filesProcessedCount;
					// result.linksUpdated is set by applyWorkspaceEdits
				} else if (dryRunCalcResult) {
					Logger.debug('No link updates were needed based on the dry run, or no edits to apply.');
					result.filesProcessed = dryRunCalcResult.filesProcessedCount;
				} else {
					// This case should ideally not be hit if dryRunCalcResult is always available before this point
					Logger.warn('Proceeding with link updates, but dry run data was not available. This is unexpected.');
					// Fallback to re-calculating edits if dryRunCalcResult is missing (should be avoided by structure)
					// For safety, this fallback is removed as dry run is now always performed before this logic.
				}
			} else {
				// This case should not be reached if userDecision is always defined when mode is not 'never'
				// and not (mode === 'always' && !options.confirmAction)
				Logger.error('Unexpected state: userDecision is undefined when it should be defined.');
				result.errors.push('Internal error: Could not determine user action for folder rename.');
				// Proceed to cache refresh, but with an error logged.
			}

			Logger.debug('Refreshing Foam workspace, graph, and matcher...');
			try {
				const oldFolderPath = fromVsCodeUri(oldUri).path;
				const newFolderPath = fromVsCodeUri(newUri).path;

				const resourcesToRemove = this.foam.workspace.list().filter(resource => {
					return resource.uri.path.startsWith(oldFolderPath + '/') || resource.uri.path === oldFolderPath;
				});
				if (resourcesToRemove.length > 0) {
					Logger.debug(`Removing ${resourcesToRemove.length} old resource(s) from workspace.`);
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
					Logger.debug(`Adding ${newFilesToAdd.length} new resource(s) to workspace.`);
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
	 * Discovers all markdown files in a folder using Foam's workspace
	 */
	private discoverMarkdownFiles(folderUri: vscode.Uri): vscode.Uri[] {
		const folderPath = fromVsCodeUri(folderUri).path;

		// Get all resources from Foam workspace that are in the renamed folder
		const markdownFilesInFolder = this.foam.workspace
			.list()
			.filter(resource => {
				const resourcePath = resource.uri.path;
				return resourcePath.startsWith(folderPath + '/') || resourcePath === folderPath;
			})
			.map(resource => toVsCodeUri(resource.uri));

		return markdownFilesInFolder;
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
	 * Calculates link update edits for a dry run
	 */
	private async calculateLinkUpdateEdits(
		oldFolderUri: vscode.Uri,
		newFolderUri: vscode.Uri,
		markdownFiles: vscode.Uri[],
		progress?: vscode.Progress<{ message?: string; increment?: number }>
	): Promise<DryRunCalculationResult> {
		const edits = new vscode.WorkspaceEdit();
		const result: DryRunCalculationResult = {
			edits,
			linksUpdatedCount: 0,
			filesToEditCount: 0,
			filesProcessedCount: 0,
			calculationErrors: [],
		};

		const processingResult = await this.processFilesForLinkUpdates(
			oldFolderUri,
			newFolderUri,
			markdownFiles,
			edits, // Pass the edits object to be populated
			progress
		);

		result.linksUpdatedCount = processingResult.linksUpdatedCount;
		result.filesProcessedCount = processingResult.filesProcessedCount;
		result.calculationErrors.push(...processingResult.calculationErrors);
		result.filesToEditCount = edits.size; // Number of unique files with edits

		return result;
	}
	/**
	 * Processes all files to find and update links affected by folder rename
	 */
	private async processFilesForLinkUpdates(
		oldFolderUri: vscode.Uri,
		newFolderUri: vscode.Uri,
		markdownFiles: vscode.Uri[],
		renameEdits: vscode.WorkspaceEdit, // Edits will be added to this object
		progress?: vscode.Progress<{ message?: string; increment?: number }>
	): Promise<ProcessFilesInternalResult> { // Changed return type
		Logger.debug(`Calculating link updates for ${markdownFiles.length} file(s) in parallel...`);
		if (progress) {
			progress.report({ message: `Analyzing ${markdownFiles.length} files for link updates...` });
		}

		const fileProcessingPromises = markdownFiles.map(async (oldFileUri) => {
			let linksUpdatedForThisFile = 0;
			const errorsForThisFile: string[] = [];

			try {
				const newFileUri = this.calculateNewFileUri(oldFileUri, oldFolderUri, newFolderUri);

				Logger.debug(`Checking backlinks for: ${vscode.workspace.asRelativePath(oldFileUri)} (new: ${vscode.workspace.asRelativePath(newFileUri)})`);

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
								// Check if the original target was a relative path
								if (target.startsWith('../')) {
									// This was a relative path - we should preserve its relative nature
									// Calculate the new relative path from the source to the new target location
									const sourceDir = connection.source.getDirectory();
									const newTargetPath = fromVsCodeUri(newFileUri);
									newTarget = newTargetPath.relativeTo(sourceDir).path;

									Logger.debug(`  → Preserving relative path: original="${target}" → new="${newTarget}"`);
								} else {
									// For path-based wikilinks like [[folder/file]], update the folder part
									const relativePath = vscode.workspace.asRelativePath(newFileUri);
									newTarget = relativePath.replace(/\\/g, '/');
								}

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
							linksUpdatedForThisFile++;
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
							linksUpdatedForThisFile++;
							Logger.debug(`  → Markdown link in "${sourceFile}" updated to: "${edit.newText}"`);
							break;
						}
					}
				}				// Now handle outgoing links from this moved file that may need relative path adjustment
				const outgoingConnections = this.foam.graph.getLinks(fromVsCodeUri(oldFileUri));

				if (outgoingConnections.length > 0) {
					Logger.debug(`Found ${outgoingConnections.length} outgoing links from ${vscode.workspace.asRelativePath(oldFileUri)}`);
				} for (const outgoingConnection of outgoingConnections) {
					const { target } = MarkdownLink.analyzeLink(outgoingConnection.link);

					Logger.debug(`Checking outgoing link: "${outgoingConnection.link.rawText}" (type: ${outgoingConnection.link.type}, target: "${target}")`);

					// Process relative links that start with ../ for both regular links and wikilinks
					// But skip links that point to files within the same renamed folder (those are handled by backlink processing)
					if (!isAbsolute(target) && target.startsWith('../')) {
						// Check if the target resolves to a file within the renamed folder
						// If so, skip it as it will be handled by backlink processing
						const targetUri = toVsCodeUri(outgoingConnection.target);
						const oldFolderPath = oldFolderUri.fsPath.replace(/\\/g, '/');
						const targetPath = targetUri.fsPath.replace(/\\/g, '/');

						if (targetPath.startsWith(oldFolderPath)) {
							Logger.debug(`  → Skipping link to file within same renamed folder (handled by backlink processing)`);
							continue;
						}

						Logger.debug(`Processing outgoing relative link: "${outgoingConnection.link.rawText}"`);

						const workspaceRootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
						if (!workspaceRootPath) {
							Logger.warn('Cannot process relative links: no workspace root found');
							continue;
						}

						const adjustedPath = this.calculateAdjustedRelativePath(
							target,
							oldFileUri,
							newFileUri,
							workspaceRootPath
						);

						if (adjustedPath && adjustedPath !== target) {
							Logger.debug(`  → Adjusting relative path "${target}" to "${adjustedPath}"`);

							const edit = MarkdownLink.createUpdateLinkEdit(outgoingConnection.link, {
								target: adjustedPath,
							});

							renameEdits.replace(
								newFileUri,  // Use the new file URI since the file has moved
								toVsCodeRange(edit.range),
								edit.newText
							);

							linksUpdatedForThisFile++;
							Logger.debug(`  → Relative link updated in moved file: "${edit.newText}"`);
						} else {
							Logger.debug(`  → No adjustment needed for relative path "${target}"`);
						}
					} else {
						Logger.debug(`  → Skipping link (absolute: ${isAbsolute(target)}, starts with ../: ${target.startsWith('../')})`);
					}
				}

				return {
					fileProcessedSuccessfully: true,
					linksUpdatedCount: linksUpdatedForThisFile,
					errors: errorsForThisFile,
				};

			} catch (error) {
				const errorMessage = `Failed to calculate link updates for file ${oldFileUri.fsPath}: ${error}`;
				errorsForThisFile.push(errorMessage);
				Logger.error(errorMessage, error);
				return {
					fileProcessedSuccessfully: false,
					linksUpdatedCount: 0,
					errors: errorsForThisFile,
				};
			}
		});

		const allProcessingResults = await Promise.all(fileProcessingPromises);

		// Aggregate results after all promises have completed
		let totalLinksUpdated = 0;
		let totalFilesProcessedSuccessfully = 0;
		const allCalculationErrors: string[] = [];

		for (const res of allProcessingResults) {
			if (res.fileProcessedSuccessfully) {
				totalFilesProcessedSuccessfully++;
			}
			totalLinksUpdated += res.linksUpdatedCount;
			allCalculationErrors.push(...res.errors);
		}

		Logger.debug(`Finished calculating link updates. Potential to update ${totalLinksUpdated} link(s) across ${renameEdits.size} file(s).`);
		if (progress) {
			progress.report({ message: `Calculation complete: ${totalLinksUpdated} potential link updates found.`, increment: 100 });
		}

		return {
			linksUpdatedCount: totalLinksUpdated,
			filesProcessedCount: totalFilesProcessedSuccessfully,
			calculationErrors: allCalculationErrors,
		};
	}

	/**
	 * Calculates an adjusted relative path when a file is moved to a different folder depth.
	 * This is needed for relative links in moved files that point outside the moved folder.
	 * 
	 * @param originalRelativePath The original relative path (e.g., "../../other.md")
	 * @param oldFileUri The original file URI
	 * @param newFileUri The new file URI after the folder move
	 * @param workspaceRootPath The workspace root path for resolving absolute paths
	 * @returns The adjusted relative path or null if adjustment is not needed/possible
	 */
	private calculateAdjustedRelativePath(
		originalRelativePath: string,
		oldFileUri: vscode.Uri,
		newFileUri: vscode.Uri,
		workspaceRootPath: string
	): string | null {
		// Only handle relative paths that go up (start with ../)
		if (!originalRelativePath.startsWith('../')) {
			return null;
		}
		try {
			// Calculate old and new folder depths relative to workspace root
			const oldRelativePath = path.relative(workspaceRootPath, path.dirname(oldFileUri.fsPath));
			const newRelativePath = path.relative(workspaceRootPath, path.dirname(newFileUri.fsPath));

			const oldDepth = oldRelativePath === '' ? 0 : oldRelativePath.split(path.sep).length;
			const newDepth = newRelativePath === '' ? 0 : newRelativePath.split(path.sep).length;

			const depthChange = newDepth - oldDepth;

			Logger.debug(`Depth calculation: old="${oldRelativePath}" (${oldDepth}), new="${newRelativePath}" (${newDepth}), change=${depthChange}`);

			if (depthChange === 0) {
				Logger.debug('No depth change, no adjustment needed');
				return null; // No depth change, no adjustment needed
			}

			// Parse the original relative path to separate the ../ segments from the target
			const segments = originalRelativePath.split('/');
			let upCount = 0;
			let targetIndex = 0;

			for (let i = 0; i < segments.length; i++) {
				if (segments[i] === '..') {
					upCount++;
				} else {
					targetIndex = i;
					break;
				}
			}

			// Adjust the up count based on depth change
			const newUpCount = upCount + depthChange;

			if (newUpCount < 0) {
				Logger.warn(`Cannot adjust relative path ${originalRelativePath}: would result in negative up count`);
				return null;
			}			// Reconstruct the path with the adjusted up count
			const newUpSegments = new Array(newUpCount).fill('..');
			const remainingSegments = segments.slice(targetIndex);
			const adjustedPath = [...newUpSegments, ...remainingSegments].join('/');

			Logger.debug(`Adjusted relative path "${originalRelativePath}" → "${adjustedPath}" (depth change: ${depthChange}, old up count: ${upCount}, new up count: ${newUpCount})`);
			return adjustedPath;

		} catch (error) {
			Logger.error(`Error calculating adjusted relative path for ${originalRelativePath}:`, error);
			return null;
		}
	}
	/**
	 * Applies workspace edits with proper error handling using a single consolidated WorkspaceEdit
	 * to minimize UI flashing and improve performance
	 */
	private async applyWorkspaceEdits(
		renameEdits: vscode.WorkspaceEdit, // These are the edits calculated in the dry run
		result: FolderRenameResult      // This is the main result object to be updated
	): Promise<void> {
		try {
			const successfulEditsPaths: string[] = [];
			let actuallyAppliedLinksCount = 0;

			let totalPotentialLinks = 0;
			for (const [, fileSpecificEdits] of renameEdits.entries()) {
				totalPotentialLinks += fileSpecificEdits.length;
			}

		/**
	 * UI Optimization: Uses consolidated WorkspaceEdit to minimize file indicator flashing.
	 * Similar optimization could be applied to single file renames in refactor.ts if needed.
	 */

			// Create a single workspace edit containing all file changes
			// This minimizes UI flashing by applying all changes atomically
			const consolidatedEdit = new vscode.WorkspaceEdit();
			const filesToProcess: vscode.Uri[] = [];

			// First, validate all files exist and collect valid edits
			for (const [uri, edits] of renameEdits.entries()) {
				try {
					await vscode.workspace.fs.stat(uri);
					consolidatedEdit.set(uri, edits);
					filesToProcess.push(uri);
					actuallyAppliedLinksCount += edits.length;
				} catch (statError) {
					Logger.warn(`Skipping edits for non-existent file: ${uri.fsPath}`);
					result.warnings.push(`File not found, skipping link updates: ${uri.fsPath}`);
				}
			}			// Apply all edits at once - this reduces UI flashing significantly
			if (filesToProcess.length > 0) {
				Logger.debug(`Applying consolidated workspace edit with changes to ${filesToProcess.length} files`);
				const success = await vscode.workspace.applyEdit(consolidatedEdit);
				
				if (!success) {
					const errorMessage = `Failed to apply consolidated workspace edit with ${totalPotentialLinks} edits across ${filesToProcess.length} files`;
					result.errors.push(errorMessage);
					Logger.error(errorMessage);
					return;
				}				// Save all affected documents after successful edit application
				// Use parallel saving for efficiency while only saving the files we modified
				Logger.debug(`Saving ${filesToProcess.length} edited documents in parallel`);
				
				const savePromises = filesToProcess.map(async (uri) => {
					try {
						const document = await vscode.workspace.openTextDocument(uri);
						if (document.isDirty) {
							await document.save();
						}
						return { uri, success: true, error: null };
					} catch (saveError) {
						return { uri, success: false, error: saveError };
					}
				});

				const saveResults = await Promise.all(savePromises);
				
				// Process save results
				for (const saveResult of saveResults) {
					if (saveResult.success) {
						successfulEditsPaths.push(vscode.workspace.asRelativePath(saveResult.uri));
					} else {
						const warningMessage = `Applied edits but failed to save ${saveResult.uri.fsPath}: ${saveResult.error}`;
						result.warnings.push(warningMessage);
						Logger.warn(warningMessage);
						// Still count as successful since the edit was applied
						successfulEditsPaths.push(vscode.workspace.asRelativePath(saveResult.uri));
					}
				}

				Logger.debug(
					`Successfully applied ${actuallyAppliedLinksCount} link updates across ${filesToProcess.length} file(s): ${successfulEditsPaths.join(', ')}`
				);
			} else {
				Logger.debug('No valid files to process for link updates');
			}

			// Update the main result object with the count of actually applied links
			result.linksUpdated = actuallyAppliedLinksCount;

			if (successfulEditsPaths.length > 0) {
				Logger.debug(
					`Successfully applied edits to the following files:`,
					successfulEditsPaths
				);

				// Use the now accurate result.linksUpdated for the message
				let message = `Updated ${FolderRenameDialog.pluralize(result.linksUpdated, 'link')} across ${FolderRenameDialog.pluralize(successfulEditsPaths.length, 'file')}.`;
				if (result.warnings.length > 0) {
					message += ` (${FolderRenameDialog.pluralize(result.warnings.length, 'warning')} - check logs for details)`;
				}

				vscode.window.showInformationMessage(message);
			} else if (totalPotentialLinks > 0) { // Changed condition to use totalPotentialLinks
				vscode.window.showWarningMessage(
					`Found ${FolderRenameDialog.pluralize(totalPotentialLinks, 'potential link')} to update but could not apply changes to any files. Check logs for details.`
				);
			}
		} catch (error) {
			const errorMessage = `Failed to apply workspace edits: ${error}`;
			result.errors.push(errorMessage);
			Logger.error(errorMessage, error);
			throw error;
		}
	}

	/**
	 * Reverts a folder rename by moving the folder back to its original location
	 */
	private async revertFolderRename(currentUri: vscode.Uri, originalUri: vscode.Uri): Promise<void> {
		Logger.debug(`Attempting to revert folder rename from "${vscode.workspace.asRelativePath(currentUri)}" back to "${vscode.workspace.asRelativePath(originalUri)}"`);

		try {
			// Check if the current folder still exists
			try {
				await vscode.workspace.fs.stat(currentUri);
			} catch {
				throw new Error(`Cannot revert: Current folder '${vscode.workspace.asRelativePath(currentUri)}' no longer exists`);
			}

			// Check if the original location is available
			try {
				await vscode.workspace.fs.stat(originalUri);
				throw new Error(`Cannot revert: Original location '${vscode.workspace.asRelativePath(originalUri)}' already exists`);
			} catch (statError) {
				// This is expected - the original location should not exist
				if (statError instanceof vscode.FileSystemError && statError.code === 'FileNotFound') {
					// Good, we can proceed with the revert
				} else {
					throw statError;
				}
			}

			// Perform the revert by renaming the folder back
			await vscode.workspace.fs.rename(currentUri, originalUri);
			Logger.debug(`Successfully reverted folder rename back to "${vscode.workspace.asRelativePath(originalUri)}"`);

		} catch (error) {
			Logger.error(`Failed to revert folder rename: ${error}`);
			throw error;
		}
	}
}
