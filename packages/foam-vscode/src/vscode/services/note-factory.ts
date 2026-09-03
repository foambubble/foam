import { SnippetString, ViewColumn, commands, window, workspace } from 'vscode';
import {
  Foam,
  FoamError,
  NoteCreationHooks,
  NoteCreationOutcome,
  NoteCreationTrigger,
  Resolver,
  Template,
  URI,
  createNote,
  isNone,
} from '@foam/core';
import {
  asAbsoluteWorkspaceUri,
  createDocAndFocus,
  deleteFile,
  fileExists,
  findSelectionContent,
  getCurrentEditorDirectory,
  replaceSelection,
} from './editor';
import { getFoamVsCodeConfig } from '../config';
import { toVsCodeUri } from '../utils/vsc-utils';

export type OnFileExistStrategy =
  | 'open'
  | 'overwrite'
  | 'cancel'
  | 'ask'
  | ((filePath: URI) => Promise<URI | undefined>);

export type OnRelativePathStrategy =
  | 'resolve-from-root'
  | 'resolve-from-current-dir'
  | 'cancel'
  | 'ask'
  | ((filePath: URI) => Promise<URI | undefined>);

const createFnForOnRelativePathStrategy =
  (onRelativePath: OnRelativePathStrategy | undefined) =>
  async (existingFile: URI) => {
    if (isNone(onRelativePath)) {
      onRelativePath =
        getFoamVsCodeConfig('files.newNotePath') === 'root'
          ? 'resolve-from-root'
          : 'resolve-from-current-dir';
    }

    if (typeof onRelativePath === 'function') {
      return onRelativePath(existingFile);
    }

    switch (onRelativePath) {
      case 'resolve-from-current-dir':
        try {
          return getCurrentEditorDirectory().joinPath(existingFile.path);
        } catch (e) {
          return asAbsoluteWorkspaceUri(existingFile);
        }
      case 'resolve-from-root':
        return asAbsoluteWorkspaceUri(existingFile);
      case 'cancel':
        return undefined;
      case 'ask':
      default: {
        const newProposedPath = await askUserForFilepathConfirmation(
          existingFile
        );
        return newProposedPath && existingFile.forPath(newProposedPath);
      }
    }
  };

const createFnForOnFileExistsStrategy =
  (onFileExists: OnFileExistStrategy) => async (existingFile: URI) => {
    if (typeof onFileExists === 'function') {
      return onFileExists(existingFile);
    }
    switch (onFileExists) {
      case 'open':
        await commands.executeCommand('vscode.open', toVsCodeUri(existingFile));
        return;
      case 'overwrite':
        await deleteFile(existingFile);
        return existingFile;
      case 'cancel':
        return undefined;
      case 'ask':
      default: {
        const newProposedPath = await askUserForFilepathConfirmation(
          existingFile
        );
        return newProposedPath && existingFile.forPath(newProposedPath);
      }
    }
  };

async function askUserForFilepathConfirmation(
  defaultFilepath: URI
): Promise<string | undefined> {
  const fsPath = defaultFilepath.toFsPath();
  const defaultFilename = defaultFilepath.getBasename();
  const defaultExtension = defaultFilepath.getExtension();
  return window.showInputBox({
    prompt: `Enter the path for the new note`,
    value: fsPath,
    valueSelection: [
      fsPath.length - defaultFilename.length,
      fsPath.length - defaultExtension.length,
    ],
    validateInput: async value =>
      value.trim().length === 0
        ? 'Please enter a value'
        : !defaultFilepath.forPath(value).isAbsolute()
        ? 'Path needs to be absolute'
        : undefined,
  });
}

export interface CreateNoteOptions {
  trigger: NoteCreationTrigger;
  /** Resolver with all variables pre-configured. */
  resolver: Resolver;
  /** Loads the template; `undefined` uses the default new-note text. */
  loadTemplate: () => Promise<Template | undefined>;
  /** Target when the template does not set a `filepath`. */
  fallbackFilepath?: URI;
  onFileExists?: OnFileExistStrategy;
  onRelativePath?: OnRelativePathStrategy;
  /** Replace the editor selection with a link to the new note. Default true. */
  replaceSelectionWithLink?: boolean;
}

export const NoteFactory = {
  /**
   * Runs the core note creation flow with VS Code behavior: the strategies
   * above for existing and relative targets, the note opened in an editor
   * as a snippet, and the selection (if any) replaced with a link to it.
   */
  createNote: async (
    foam: Foam,
    options: CreateNoteOptions
  ): Promise<{ didCreateFile: boolean; uri: URI | undefined }> => {
    const { replaceSelectionWithLink = true } = options;
    const selectedContent = findSelectionContent();
    const hooks: NoteCreationHooks = {
      loadTemplate: options.loadTemplate,
      fileExists,
      onFileExists: createFnForOnFileExistsStrategy(options.onFileExists),
      onRelativePath: createFnForOnRelativePathStrategy(options.onRelativePath),
      writeNote: (uri, content) =>
        createDocAndFocus(
          new SnippetString(content),
          uri,
          selectedContent ? ViewColumn.Beside : ViewColumn.Active
        ),
      onDidCreate: async uri => {
        if (replaceSelectionWithLink && selectedContent !== undefined) {
          await replaceSelection(
            selectedContent.document,
            selectedContent.selection,
            `[[${uri.getName()}]]`
          );
        }
      },
    };

    let outcome: NoteCreationOutcome;
    try {
      outcome = await createNote(
        {
          foam,
          trigger: options.trigger,
          resolver: options.resolver,
          fallbackFilepath: options.fallbackFilepath,
          isTrusted: workspace.isTrusted,
        },
        hooks
      );
    } catch (err) {
      if (err instanceof FoamError && err.code === 'invalid_input') {
        throw new Error(
          `${err.message}. The workspace is in Restricted Mode: trust it to allow this.`
        );
      }
      throw err;
    }

    switch (outcome.status) {
      case 'created':
        return { didCreateFile: true, uri: outcome.uri };
      case 'exists':
        return { didCreateFile: false, uri: outcome.uri };
      case 'cancelled':
        return { didCreateFile: false, uri: undefined };
    }
  },
};
