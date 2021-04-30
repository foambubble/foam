// TODO: this file has some utility functions also present in foam-core testing
// they should be consolidated

import * as vscode from 'vscode';
import path from 'path';
import {
  URI,
  NoteLinkDefinition,
  Resource,
  Range,
  FoamWorkspace,
  Matcher,
  MarkdownResourceProvider,
} from 'foam-core';
import { TextEncoder } from 'util';
import { toVsCodeUri } from '../utils/vsc-utils';

const position = Range.create(0, 0, 0, 100);

const documentStart = position.start;
const documentEnd = position.end;
const eol = '\n';

/**
 * Turns a string into a URI
 * The goal of this function is to make sure we are consistent in the
 * way we generate URIs (and therefore IDs) across the tests
 */
export const strToUri = URI.file;

export const createTestWorkspace = () => {
  const workspace = new FoamWorkspace();
  const matcher = new Matcher([URI.file('/')], ['**/*']);
  const provider = new MarkdownResourceProvider(matcher, undefined, undefined, {
    read: _ => Promise.resolve(''),
    list: _ => Promise.resolve([]),
  });
  workspace.registerProvider(provider);
  return workspace;
};

export const createTestNote = (params: {
  uri: string;
  title?: string;
  definitions?: NoteLinkDefinition[];
  links?: Array<{ slug: string } | { to: string }>;
  text?: string;
  root?: URI;
}): Resource => {
  const root = params.root ?? URI.file('/');
  return {
    uri: URI.resolve(params.uri, root),
    type: 'note',
    properties: {},
    title: params.title ?? path.parse(strToUri(params.uri).path).base,
    definitions: params.definitions ?? [],
    tags: new Set(),
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
                slug: link.slug,
                target: link.slug,
                range: range,
                text: 'link text',
              }
            : {
                type: 'link',
                target: link.to,
                label: 'link text',
                range: range,
              };
        })
      : [],
    source: {
      eol: eol,
      end: documentEnd,
      contentStart: documentStart,
      text: params.text ?? '',
    },
  };
};

export const cleanWorkspace = async () => {
  const files = await vscode.workspace.findFiles('**', '.vscode');
  await Promise.all(files.map(f => vscode.workspace.fs.delete(f)));
};

export const wait = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

export const showInEditor = async (uri: URI) => {
  const doc = await vscode.workspace.openTextDocument(toVsCodeUri(uri));
  const editor = await vscode.window.showTextDocument(doc);
  return { doc, editor };
};

export const closeEditors = async () => {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  await wait(100);
};

const chars = 'abcdefghijklmnopqrstuvwyxzABCDEFGHIJKLMNOPQRSTUVWYXZ1234567890';
export const randomString = (len = 5) =>
  new Array(len)
    .fill('')
    .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
    .join('');

/**
 * Creates a file with a some content.
 *
 * @param content the file content
 * @param path relative file path
 * @returns an object containing various information about the file created
 */
export const createFile = async (content: string, filepath?: string) => {
  const rootUri = vscode.workspace.workspaceFolders[0].uri;
  filepath = filepath ?? randomString() + '.md';
  const uri = vscode.Uri.joinPath(rootUri, filepath);
  const filenameComponents = path.parse(uri.fsPath);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
  return { uri, content, ...filenameComponents };
};

export const createNote = (r: Resource) => {
  let content = `# ${r.title}

  some content and ${r.links
    .map(l =>
      l.type === 'wikilink' ? `[[${l.slug}]]` : `[${l.label}](${l.target})`
    )
    .join(' some content between links.\n')}
  last line.
`;
  return vscode.workspace.fs.writeFile(
    toVsCodeUri(r.uri),
    new TextEncoder().encode(content)
  );
};
