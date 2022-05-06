/*
 * This file depends on VS Code as it's used for integration/e2e tests
 */
import * as vscode from 'vscode';
import path from 'path';
import { TextDecoder, TextEncoder } from 'util';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { Logger } from '../core/utils/log';
import { URI } from '../core/model/uri';
import { Resource } from '../core/model/note';
import { randomString, wait } from './test-utils';

Logger.setLevel('error');

export const cleanWorkspace = async () => {
  const files = await vscode.workspace.findFiles('**', '{.vscode,.keep}');
  await Promise.all(files.map(f => vscode.workspace.fs.delete(f)));
};

export const showInEditor = async (uri: URI) => {
  const doc = await vscode.workspace.openTextDocument(toVsCodeUri(uri));
  const editor = await vscode.window.showTextDocument(doc);
  return { doc, editor };
};

export const closeEditors = async () => {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  await wait(100);
};

export const deleteFile = (file: URI | { uri: URI }) => {
  const uri = 'uri' in file ? file.uri : file;
  return vscode.workspace.fs.delete(toVsCodeUri(uri), { recursive: true });
};

/**
 * Generates a URI within the workspace, either randomly
 * or by using the provided path components
 *
 * @param filepath optional path components for the URI
 * @returns a URI within the workspace
 */
export const getUriInWorkspace = (...filepath: string[]) => {
  const rootUri = fromVsCodeUri(vscode.workspace.workspaceFolders[0].uri);
  filepath = filepath.length > 0 ? filepath : [randomString() + '.md'];
  const uri = rootUri.joinPath(...filepath);
  return uri;
};

/**
 * Creates a file with a some content.
 *
 * @param content the file content
 * @param path relative file path
 * @returns an object containing various information about the file created
 */
export const createFile = async (content: string, filepath: string[] = []) => {
  const uri = getUriInWorkspace(...filepath);
  const filenameComponents = path.parse(uri.toFsPath());
  await vscode.workspace.fs.writeFile(
    toVsCodeUri(uri),
    new TextEncoder().encode(content)
  );
  return { uri, content, ...filenameComponents };
};

export const renameFile = (from: URI, to: URI) => {
  const edit = new vscode.WorkspaceEdit();
  edit.renameFile(toVsCodeUri(from), toVsCodeUri(to));
  return vscode.workspace.applyEdit(edit);
};

const decoder = new TextDecoder('utf-8');
export const readFile = async (uri: URI) => {
  const content = await vscode.workspace.fs.readFile(toVsCodeUri(uri));
  return decoder.decode(content);
};

export const createNote = (r: Resource) => {
  const content = `# ${r.title}

  some content and ${r.links
    .map(l => l.rawText)
    .join(' some content between links.\n')}
  last line.
`;
  return vscode.workspace.fs.writeFile(
    toVsCodeUri(r.uri),
    new TextEncoder().encode(content)
  );
};
