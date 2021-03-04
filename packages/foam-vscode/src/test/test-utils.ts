// TODO: this file has some utility functions also present in foam-core testing
// they should be consolidated

import * as vscode from 'vscode';
import path from 'path';
import {
  URI,
  Attachment,
  NoteLinkDefinition,
  Note,
  Placeholder,
  parseUri,
} from 'foam-core';
import { TextEncoder } from 'util';

const position = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 },
};

const documentStart = position.start;
const documentEnd = position.end;
const eol = '\n';

/**
 * Turns a string into a URI
 * The goal of this function is to make sure we are consistent in the
 * way we generate URIs (and therefore IDs) across the tests
 */
export const strToUri = URI.file;

export const createPlaceholder = (params: { uri: string }): Placeholder => {
  return {
    uri: strToUri(params.uri),
    type: 'placeholder',
  };
};

export const createAttachment = (params: { uri: string }): Attachment => {
  return {
    uri: strToUri(params.uri),
    type: 'attachment',
  };
};

export const createTestNote = (params: {
  uri: string;
  title?: string;
  definitions?: NoteLinkDefinition[];
  links?: Array<{ slug: string } | { to: string }>;
  text?: string;
  root?: URI;
}): Note => {
  const root = params.root ?? URI.file('/');
  return {
    uri: parseUri(root, params.uri),
    type: 'note',
    properties: {},
    title: params.title ?? path.parse(strToUri(params.uri).path).base,
    definitions: params.definitions ?? [],
    tags: new Set(),
    links: params.links
      ? params.links.map((link, index) => {
          const pos = {
            start: {
              line: position.start.line + index,
              column: position.start.column,
            },
            end: position.end,
          };
          return 'slug' in link
            ? {
                type: 'wikilink',
                slug: link.slug,
                target: link.slug,
                position: pos,
                text: 'link text',
              }
            : {
                type: 'link',
                target: link.to,
                label: 'link text',
                position: pos,
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

export const closeEditors = async () => {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  await wait(100);
};

export const createNote = (r: Note) => {
  let content = `# ${r.title}

  some content and ${r.links
    .map(l =>
      l.type === 'wikilink' ? `[[${l.slug}]]` : `[${l.label}](${l.target})`
    )
    .join(' some content between links.\n')}
  last line.
`;
  return vscode.workspace.fs.writeFile(
    r.uri,
    new TextEncoder().encode(content)
  );
};
