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
                return getPlaceholderLink(wikilink);
              }
              switch (resource.type) {
                case 'note':
                  return `<a class='foam-note-link' title='${resource.title}' href='${resource.uri.fsPath}'>${wikilink}</a>`;
                case 'attachment':
                  return `<a class='foam-attachment-link' title='attachment' href='${resource.uri.fsPath}'>${wikilink}</a>`;
                case 'placeholder':
                  return getPlaceholderLink(wikilink);
                default:
                  const _: never = resource;
                  return getPlaceholderLink(wikilink);
              }
            } catch (e) {
              Logger.error(
                `Error while creating link for [[${wikilink}]] in Preview panel`,
                e
              );
              return getPlaceholderLink(wikilink);
            }
          },
        });
      },
    };
  },
};

const getPlaceholderLink = (content: string) =>
  `<span class='foam-placeholder-link'>${content}</span>`;

export default feature;
