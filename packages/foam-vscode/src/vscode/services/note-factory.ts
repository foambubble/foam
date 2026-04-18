import { SnippetString, ViewColumn, commands, window } from 'vscode';
import { URI } from '../../core/model/uri';
import { Resolver } from '../../core/templates/variable-resolver';
import { UserCancelledOperation } from './errors';
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
import { isNone } from '../../core/utils';

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

export const NoteFactory = {
  createNote: async (
    newFilePath: URI,
    text: string,
    resolver: Resolver,
    onFileExistsStrategy?: OnFileExistStrategy,
    onRelativePathStrategy?: OnRelativePathStrategy,
    replaceSelectionWithLink = true
  ): Promise<{ didCreateFile: boolean; uri: URI | undefined }> => {
    try {
      const onRelativePath = createFnForOnRelativePathStrategy(
        onRelativePathStrategy
      );
      const onFileExists =
        createFnForOnFileExistsStrategy(onFileExistsStrategy);

      let resolvedNewFilePath = asAbsoluteWorkspaceUri(newFilePath);
      while (
        (await fileExists(resolvedNewFilePath)) ||
        !newFilePath.isAbsolute()
      ) {
        while (!newFilePath.isAbsolute()) {
          const proposedNewFilepath = await onRelativePath(newFilePath);
          if (proposedNewFilepath === undefined) {
            return { didCreateFile: false, uri: resolvedNewFilePath };
          }
          newFilePath = proposedNewFilepath;
        }
        resolvedNewFilePath = asAbsoluteWorkspaceUri(newFilePath);
        while (
          newFilePath.isAbsolute() &&
          (await fileExists(resolvedNewFilePath))
        ) {
          const proposedNewFilepath = await onFileExists(resolvedNewFilePath);
          if (proposedNewFilepath === undefined) {
            return { didCreateFile: false, uri: resolvedNewFilePath };
          }
          newFilePath = proposedNewFilepath;
          resolvedNewFilePath = asAbsoluteWorkspaceUri(newFilePath);
        }
      }

      const expandedText = await resolver.resolveText(text);
      const selectedContent = findSelectionContent();
      await createDocAndFocus(
        new SnippetString(expandedText),
        resolvedNewFilePath,
        selectedContent ? ViewColumn.Beside : ViewColumn.Active
      );

      if (replaceSelectionWithLink && selectedContent !== undefined) {
        const newNoteTitle = resolvedNewFilePath.getName();
        await replaceSelection(
          selectedContent.document,
          selectedContent.selection,
          `[[${newNoteTitle}]]`
        );
      }

      return { didCreateFile: true, uri: resolvedNewFilePath };
    } catch (err) {
      if (err instanceof UserCancelledOperation) {
        return;
      }
      throw err;
    }
  },
};
