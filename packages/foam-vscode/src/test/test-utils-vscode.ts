/*
 * This file depends on VS Code as it's used for integration/e2e tests
 */
import * as vscode from 'vscode';
import path from 'path';
import { TextDecoder, TextEncoder } from 'util';
import { toVsCodeUri } from '../utils/vsc-utils';
import { Logger } from '../core/utils/log';
import { URI } from '../core/model/uri';
import { Resource } from '../core/model/note';
import { randomString, wait } from './test-utils';

Logger.setLevel('error');

export const cleanWorkspace = async () => {
  const files = await vscode.workspace.findFiles('**', '.vscode');
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

/**
 * Creates a file with a some content.
 *
 * @param content the file content
 * @param path relative file path
 * @returns an object containing various information about the file created
 */
export const createFile = async (content: string, filepath?: string[]) => {
  const rootUri = vscode.workspace.workspaceFolders[0].uri;
  filepath = filepath ?? [randomString() + '.md'];
  const uri = vscode.Uri.joinPath(rootUri, ...filepath);
  const filenameComponents = path.parse(uri.fsPath);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
  return { uri, content, ...filenameComponents };
};

export const readFile = async (filepath?: string[] | URI): Promise<string> => {
  const rootUri = vscode.workspace.workspaceFolders[0].uri;
  filepath = filepath ?? [randomString() + '.md'];
  const uri = URI.isUri(filepath)
    ? filepath
    : vscode.Uri.joinPath(rootUri, ...filepath);
  return vscode.workspace.fs
    .readFile(toVsCodeUri(uri))
    .then(b => new TextDecoder().decode(b));
};

export const createNote = (r: Resource) => {
  let content = `# ${r.title}

  some content and ${r.links
    .map(l =>
      l.type === 'wikilink' ? `[[${l.label}]]` : `[${l.label}](${l.target})`
    )
    .join(' some content between links.\n')}
  last line.
`;
  return vscode.workspace.fs.writeFile(
    toVsCodeUri(r.uri),
    new TextEncoder().encode(content)
  );
};
