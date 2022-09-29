import { asAbsoluteUri, URI } from '../core/model/uri';
import { TextEncoder } from 'util';
import {
  FileType,
  Selection,
  SnippetString,
  TextDocument,
  ViewColumn,
  window,
  workspace,
  WorkspaceEdit,
} from 'vscode';
import { focusNote } from '../utils';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { isSome } from '../core/utils';

interface SelectionInfo {
  document: TextDocument;
  selection: Selection;
  content: string;
}

export function findSelectionContent(): SelectionInfo | undefined {
  const editor = window.activeTextEditor;
  if (editor === undefined) {
    return undefined;
  }

  const document = editor.document;
  const selection = editor.selection;

  if (!document || selection.isEmpty) {
    return undefined;
  }

  return {
    document,
    selection,
    content: document.getText(selection),
  };
}

export async function createDocAndFocus(
  text: SnippetString,
  filepath: URI,
  viewColumn: ViewColumn = ViewColumn.Active
) {
  await workspace.fs.writeFile(
    toVsCodeUri(filepath),
    new TextEncoder().encode('')
  );
  const note = await focusNote(filepath, true, viewColumn);
  await note.editor.insertSnippet(text);
  await note.document.save();
}

export async function replaceSelection(
  document: TextDocument,
  selection: Selection,
  content: string
) {
  const originatingFileEdit = new WorkspaceEdit();
  originatingFileEdit.replace(document.uri, selection, content);
  await workspace.applyEdit(originatingFileEdit);
}

/**
 * Returns the directory of the file currently open in the editor.
 * If no file is open in the editor it will return the first folder
 * in the workspace.
 * If both aren't available it will throw.
 *
 * @returns URI
 * @throws Error if no file is open in editor AND no workspace folder defined
 */
export function getCurrentEditorDirectory(): URI {
  const uri = window.activeTextEditor?.document?.uri;

  if (isSome(uri)) {
    return fromVsCodeUri(uri).getDirectory();
  }

  if (workspace.workspaceFolders.length > 0) {
    return fromVsCodeUri(workspace.workspaceFolders[0].uri);
  }

  throw new Error('A file must be open in editor, or workspace folder needed');
}

export async function fileExists(uri: URI): Promise<boolean> {
  try {
    const stat = await workspace.fs.stat(toVsCodeUri(uri));
    return stat.type === FileType.File;
  } catch (e) {
    return false;
  }
}

export async function readFile(uri: URI): Promise<string | undefined> {
  if (await fileExists(uri)) {
    return workspace.fs
      .readFile(toVsCodeUri(uri))
      .then(bytes => bytes.toString());
  }
  return undefined;
}

export const deleteFile = (uri: URI) => {
  return workspace.fs.delete(toVsCodeUri(uri), { recursive: true });
};

/**
 * Turns a relative URI into an absolute URI for the given workspace.
 * @param uri the uri to evaluate
 * @returns an absolute uri
 */
export function asAbsoluteWorkspaceUri(uri: URI): URI {
  if (workspace.workspaceFolders === undefined) {
    throw new Error('An open folder or workspace is required');
  }
  const folders = workspace.workspaceFolders.map(folder =>
    fromVsCodeUri(folder.uri)
  );
  const res = asAbsoluteUri(uri, folders);
  return res;
}
