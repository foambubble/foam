import * as vscode from 'vscode';
import markdownItRegex from 'markdown-it-regex';
import { Foam, Logger } from 'foam-core';
import { FoamFeature } from '../types';

const feature: FoamFeature = {
  activate: async (
    _context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    return {
      extendMarkdownIt: (md: markdownit) => {
        return md.use(markdownItRegex, {
          name: 'connect-wikilinks',
          regex: /\[\[([^\[\]]+?)\]\]/,
          replace: (wikilink: string) => {
            try {
              const resource = foam.workspace.find(wikilink);
              if (resource == null) {
                return getInvalidLink(wikilink);
              }
              switch (resource.type) {
                case 'note':
                  return `<a title='${resource.title}' href='${resource.uri.fsPath}'>${wikilink}</a>`;
                case 'attachment':
                  return `<a title='attachment' href='${resource.uri.fsPath}'>${wikilink}</a>`;
                case 'placeholder':
                  return getInvalidLink(wikilink);
              }
            } catch (e) {
              Logger.error('Error while creating links in Preview panel', e);
              return getInvalidLink(wikilink);
            }
          },
        });
      },
    };
  },
};

const getInvalidLink = (content: string) =>
  `<span style='color:red;'>${content}</span>`;

export default feature;
