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
import { FoamWorkspace } from '../core/model/workspace';
import { Foam } from '../core/model/foam';

Logger.setLevel('error');

export const cleanWorkspace = async () => {
  const files = await vscode.workspace.findFiles('**', '{.vscode,.keep}');
  await Promise.all(files.map(f => deleteFile(fromVsCodeUri(f))));
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

export const deleteFile = async (file: URI | { uri: URI }) => {
  const uri = 'uri' in file ? file.uri : file;
  try {
    await vscode.workspace.fs.delete(toVsCodeUri(uri), {
      recursive: true,
    });
  } catch (e) {
    // ignore
  }
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

export const getFoamFromVSCode = async (): Promise<Foam> => {
  // In test environment, try different extension IDs
  const extension = vscode.extensions.getExtension('foam.foam-vscode');

  const exports = extension.isActive
    ? extension.exports
    : await extension.activate();
  if (!exports || !exports.foam) {
    throw new Error('Foam not available in extension exports');
  }

  return exports.foam;
};

export const waitForNoteInFoamWorkspace = async (uri: URI, timeout = 5000) => {
  const start = Date.now();
  const foam = await getFoamFromVSCode();
  const workspace = foam.workspace;

  // Wait for the workspace to discover the note
  while (Date.now() - start < timeout) {
    if (workspace.find(uri.path)) {
      return true;
    }
    await wait(100);
  }
  return false;
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

export const runCommand = async <T>(command: string, args: T = undefined) =>
  vscode.commands.executeCommand(command, args);

/**
 * Runs a function with a modified configuration and
 * restores the original configuration afterwards
 *
 * @param key the key of the configuration to modify
 * @param value the value to set the configuration to
 * @param fn the function to execute
 */
export const withModifiedConfiguration = async (key, value, fn: () => void) => {
  const old = vscode.workspace.getConfiguration().inspect(key);
  await vscode.workspace.getConfiguration().update(key, value);
  await fn();
  await vscode.workspace.getConfiguration().update(key, old.workspaceValue);
};

/**
 * Runs a function with a modified Foam configuration and
 * restores the original configuration afterwards
 *
 * @param key the key of the Foam configuration to modify
 * @param value the value to set the configuration to
 * @param fn the function to execute
 */
export const withModifiedFoamConfiguration = (key, value, fn: () => void) =>
  withModifiedConfiguration(`foam.${key}`, value, fn);

/**
 * Utility function to check if two URIs are the same.
 * It has the goal of supporting Uri and URI, and dealing with
 * inconsistencies in the way they are represented (especially the
 * drive letter in Windows)
 *
 * @param actual the actual value
 * @param expected the expected value
 */
export const expectSameUri = (
  actual: vscode.Uri | URI,
  expected: vscode.Uri | URI
) => {
  expect(actual.path.toLocaleLowerCase()).toEqual(
    expected.path.toLocaleLowerCase()
  );
};
