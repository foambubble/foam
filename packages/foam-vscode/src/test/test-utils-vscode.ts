/*
 * This file depends on VS Code as it's used for integration/e2e tests
 */
import * as vscode from 'vscode';
import path from 'path';
import { TextDecoder, TextEncoder } from 'util';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { Logger } from '../core/utils/log';
import { URI } from '../core/model/uri';
import { Range } from '../core/model/range';
import { NoteLinkDefinition, Resource } from '../core/model/note';

Logger.setLevel('error');

const position = Range.create(0, 0, 0, 100);

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

export const wait = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

const chars = 'abcdefghijklmnopqrstuvwyxzABCDEFGHIJKLMNOPQRSTUVWYXZ1234567890';
export const randomString = (len = 5) =>
  new Array(len)
    .fill('')
    .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
    .join('');

export const createTestNote = (params: {
  uri: string;
  title?: string;
  definitions?: NoteLinkDefinition[];
  links?: Array<{ slug: string } | { to: string }>;
  tags?: string[];
  aliases?: string[];
  text?: string;
  sections?: string[];
  root?: URI;
  type?: string;
}): Resource => {
  const root = params.root ?? URI.file('/');
  return {
    uri: root.resolve(params.uri),
    type: params.type ?? 'note',
    properties: {},
    title: params.title ?? strToUri(params.uri).getBasename(),
    definitions: params.definitions ?? [],
    sections: params.sections?.map(label => ({
      label,
      range: Range.create(0, 0, 1, 0),
    })),
    tags:
      params.tags?.map(t => ({
        label: t,
        range: Range.create(0, 0, 0, 0),
      })) ?? [],
    aliases:
      params.aliases?.map(a => ({
        title: a,
        range: Range.create(0, 0, 0, 0),
      })) ?? [],
    links: params.links
      ? params.links.map((link, index) => {
          const range = Range.create(
            position.start.line + index,
            position.start.character,
            position.start.line + index,
            position.end.character
          );
          return 'slug' in link
            ? {
                type: 'wikilink',
                range: range,
                rawText: `[[${link.slug}]]`,
                isEmbed: false,
              }
            : {
                type: 'link',
                range: range,
                rawText: `[link text](${link.to})`,
                isEmbed: false,
              };
        })
      : [],
  };
};

/**
 * Turns a string into a URI
 * The goal of this function is to make sure we are consistent in the
 * way we generate URIs (and therefore IDs) across the tests
 */
export const strToUri = URI.file;
