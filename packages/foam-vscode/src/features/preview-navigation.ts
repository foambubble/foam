import { Foam, FoamWorkspace, Logger, URI } from 'foam-core';
import markdownItRegex from 'markdown-it-regex';
import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { isNone } from '../utils';

const ALIAS_DIVIDER_CHAR = '|';

const feature: FoamFeature = {
  activate: async (
    _context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    return {
      extendMarkdownIt: (md: markdownit) => {
        return [
          markdownItWithFoamTags,
          markdownItWithFoamLinks,
          markdownItWithRemoveLinkReferences,
        ].reduce((acc, extension) => extension(acc, foam.workspace), md);
      },
    };
  },
};

export const markdownItWithFoamLinks = (
  md: markdownit,
  workspace: FoamWorkspace
) => {
  return md.use(markdownItRegex, {
    name: 'connect-wikilinks',
    regex: /\[\[([^[\]]+?)\]\]/,
    replace: (wikilink: string) => {
      try {
        const linkHasAlias = wikilink.includes(ALIAS_DIVIDER_CHAR);
        const resourceLink = linkHasAlias
          ? wikilink.substring(0, wikilink.indexOf('|'))
          : wikilink;

        const resource = workspace.find(resourceLink);
        if (isNone(resource)) {
          return getPlaceholderLink(resourceLink);
        }

        const linkLabel = linkHasAlias
          ? wikilink.substr(wikilink.indexOf('|') + 1)
          : wikilink;

        return `<a class='foam-note-link' title='${
          resource.title
        }' href='${URI.toFsPath(resource.uri)}'>${linkLabel}</a>`;
      } catch (e) {
        Logger.error(
          `Error while creating link for [[${wikilink}]] in Preview panel`,
          e
        );
        return getPlaceholderLink(wikilink);
      }
    },
  });
};

const getPlaceholderLink = (content: string) =>
  `<a class='foam-placeholder-link' title="Link to non-existing resource" href="javascript:void(0);">${content}</a>`;

export const markdownItWithFoamTags = (
  md: markdownit,
  workspace: FoamWorkspace
) => {
  return md.use(markdownItRegex, {
    name: 'foam-tags',
    regex: /(#\w+)/,
    replace: (tag: string) => {
      try {
        const resource = workspace.find(tag);
        if (isNone(resource)) {
          return getFoamTag(tag);
        }
      } catch (e) {
        Logger.error(
          `Error while creating link for ${tag} in Preview panel`,
          e
        );
        return getFoamTag(tag);
      }
    },
  });
};

const getFoamTag = (content: string) =>
  `<span class='foam-tag'>${content}</span>`;

export const markdownItWithRemoveLinkReferences = (
  md: markdownit,
  workspace: FoamWorkspace
) => {
  // Add a custom rule to execute after the defult link rule to strip away the text
  // before the alias of the WikiLink.

  // As state is on block level the token array con have multiple links. We need to process
  // them all. As such we are iterating to find all instances of link_open and find the next
  // link_close token. We then determine the content between the tokens and if it has an alias.
  // If it has an alias we iterate over all tokens in between to strip them to the desired content.
  md.inline.ruler.after('link', 'replace-alias', state => {
    if (state.tokens.filter(t => t.type === 'link_open').length > 0) {
      let iteratorInLinkBlock = false;
      let linkBlockContainsAlias = false;
      state.tokens.forEach((token, currentTokenIndex) => {
        if (!iteratorInLinkBlock && token.type !== 'link_open') {
          return;
        }

        iteratorInLinkBlock = true;
        if (iteratorInLinkBlock && token.type === 'link_close') {
          iteratorInLinkBlock = false;
          linkBlockContainsAlias = false;
          return;
        }

        if (token.type === 'link_open') {
          const nextLinkClosePosition = state.tokens
            .slice(currentTokenIndex + 1)
            .findIndex(t => t.type === 'link_close');

          const linkContent = state.tokens
            .slice(
              currentTokenIndex + 1,
              nextLinkClosePosition + currentTokenIndex + 1
            )
            .reduce((linkContent, token) => {
              return linkContent + token.content;
            }, '');

          if (linkContent.includes(ALIAS_DIVIDER_CHAR)) {
            linkBlockContainsAlias = true;
          }
        }

        if (linkBlockContainsAlias) {
          if (token.content.includes(ALIAS_DIVIDER_CHAR)) {
            const dividerPosition = token.content.indexOf(ALIAS_DIVIDER_CHAR);
            token.content = token.content.substr(
              dividerPosition + 1,
              token.content.length - dividerPosition - 1
            );
          } else {
            token.content = '';
          }
        }
      });
    } else {
      return false;
    }
  });
  return md;
};

export default feature;
