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

    try {
      // Get configuration settings
      const mode = getFoamVsCodeConfig<string>('links.folderRename.mode', 'ask');
      const maxFiles = getFoamVsCodeConfig<number>('links.folderRename.maxFiles', 500);
      const showProgress = getFoamVsCodeConfig<boolean>('links.folderRename.showProgress', true);

      // Check user preference
      if (mode === 'never') {
        Logger.info('Folder rename link updates disabled by user configuration');
        return result;
      }

      // Discover markdown files in the renamed folder
      const markdownFiles = await this.discoverMarkdownFiles(oldUri);
      
      if (markdownFiles.length === 0) {
        Logger.info(`No markdown files found in renamed folder: ${oldUri.fsPath}`);
        return result;
      }

      // Check file limit
      if (markdownFiles.length > maxFiles) {
        const message = `Folder contains ${markdownFiles.length} files, exceeding limit of ${maxFiles}. Link updates will be skipped.`;
        result.warnings.push(message);
        vscode.window.showWarningMessage(`Foam: ${message}`);
        return result;
      }

      // Ask for confirmation if needed
      if (mode === 'ask' || options.confirmAction) {
        const action = await this.askUserConfirmation(markdownFiles.length, oldUri, newUri);
        if (action !== 'proceed') {
          Logger.info('User declined folder rename link updates');
          return result;
        }
      }

      // Perform the link updates
      return await this.updateLinksForFolderRename(
        oldUri,
        newUri,
        markdownFiles,
        { ...options, showProgress }
      );

    } catch (error) {
      const errorMessage = `Failed to handle folder rename: ${error}`;
      result.errors.push(errorMessage);
      Logger.error(errorMessage, error);
      return result;
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
        
        // Find all links that point to this file
        const connections = this.foam.graph.getBacklinks(fromVsCodeUri(oldFileUri));
        
        for (const connection of connections) {
          const { target } = MarkdownLink.analyzeLink(connection.link);
          
          switch (connection.link.type) {
            case 'wikilink': {
              const identifier = this.foam.workspace.getIdentifier(
                fromVsCodeUri(newFileUri),
                [fromVsCodeUri(oldFileUri)]
              );
              const edit = MarkdownLink.createUpdateLinkEdit(connection.link, {
                target: identifier,
              });
              renameEdits.replace(
                toVsCodeUri(connection.source),
                toVsCodeRange(edit.range),
                edit.newText
              );
              result.linksUpdated++;
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
              });
              renameEdits.replace(
                toVsCodeUri(connection.source),
                toVsCodeRange(edit.range),
                edit.newText
              );
              result.linksUpdated++;
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
  }

  /**
   * Applies workspace edits with proper error handling
   */
  private async applyWorkspaceEdits(
    renameEdits: vscode.WorkspaceEdit,
    result: FolderRenameResult
  ): Promise<void> {
    try {
      // We break the update by file because applying it at once was causing
      // dirty state and editors not always saving or closing
      for (const [uri, edits] of renameEdits.entries()) {
        try {
          const fileEdits = new vscode.WorkspaceEdit();
          fileEdits.set(uri, edits);
          await vscode.workspace.applyEdit(fileEdits);
          
          const editor = await vscode.workspace.openTextDocument(uri);
          await editor.save();
        } catch (error) {
          const errorMessage = `Failed to apply edits to ${uri.fsPath}: ${error}`;
          result.errors.push(errorMessage);
          Logger.error(errorMessage, error);
        }
      }

      // Report success
      const links = result.linksUpdated > 1 ? 'links' : 'link';
      const nFiles = renameEdits.size;
      const files = nFiles > 1 ? 'files' : 'file';
      
      Logger.info(
        `Updated links in the following files:`,
        ...renameEdits.entries().map(e => vscode.workspace.asRelativePath(e[0]))
      );
      
      vscode.window.showInformationMessage(
        `Updated ${result.linksUpdated} ${links} across ${nFiles} ${files}.`
      );

    } catch (error) {
      const errorMessage = `Failed to apply workspace edits: ${error}`;
      result.errors.push(errorMessage);
      Logger.error(errorMessage, error);
      throw error;
    }
  }
}
