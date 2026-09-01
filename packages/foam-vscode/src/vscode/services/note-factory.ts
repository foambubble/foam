import { SnippetString, ViewColumn, commands, window, workspace } from 'vscode';
import { URI } from '@foam/core';
import { Resolver, isWithinPath } from '@foam/core';
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
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { isNone } from '@foam/core';

/**
 * Whether a note may be created at `target`.
 *
 * In an untrusted workspace the note must land inside one of the workspace
 * roots. Templates are workspace content like any other, and a `filepath`
 * that escapes the root (e.g. `../../.zshrc`) would turn note creation into
 * an arbitrary-write primitive without the user ever opting in.
 *
 * Trusting the workspace lifts the restriction: templates are then the user's
 * own, and filing a note into a sibling directory is a legitimate thing to
 * want. Workspace trust is the deliberate, persistent opt-in VS Code already
 * provides, which is why there's no per-note prompt here.
 *
 * The CLI and MCP have the same guard applied unconditionally in `@foam/core`'s
 * `noteCreate` — they're non-interactive, so there is no trust to grant.
 */
export function isNoteTargetAllowed(
  target: URI,
  roots: URI[],
  isTrusted: boolean
): boolean {
  return isTrusted || roots.some(root => isWithinPath(target, root));
}

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

      // Every candidate path is checked as soon as it resolves, not just the
      // final one: the `overwrite` strategy below deletes an existing file
      // inside the loop, so a check placed only before the write would let an
      // escaping path destroy a file outside the workspace first.
      const roots =
        workspace.workspaceFolders?.map(folder => fromVsCodeUri(folder.uri)) ??
        [];
      const resolveInWorkspace = (uri: URI): URI => {
        const resolved = asAbsoluteWorkspaceUri(uri);
        if (!isNoteTargetAllowed(resolved, roots, workspace.isTrusted)) {
          throw new Error(
            `Cannot create a note outside the workspace while in Restricted Mode: ${resolved.toFsPath()}. Trust this workspace to allow it.`
          );
        }
        return resolved;
      };

      let resolvedNewFilePath = resolveInWorkspace(newFilePath);
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
        resolvedNewFilePath = resolveInWorkspace(newFilePath);
        while (
          newFilePath.isAbsolute() &&
          (await fileExists(resolvedNewFilePath))
        ) {
          const proposedNewFilepath = await onFileExists(resolvedNewFilePath);
          if (proposedNewFilepath === undefined) {
            return { didCreateFile: false, uri: resolvedNewFilePath };
          }
          newFilePath = proposedNewFilepath;
          resolvedNewFilePath = resolveInWorkspace(newFilePath);
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
