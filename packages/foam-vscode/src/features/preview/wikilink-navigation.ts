/*global markdownit:readonly*/

import markdownItRegex from 'markdown-it-regex';
import * as vscode from 'vscode';
import { FoamWorkspace } from '../../core/model/workspace';
import { Logger } from '../../core/utils/log';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { MarkdownLink } from '../../core/services/markdown-link';
import { Range } from '../../core/model/range';
import { isEmpty } from 'lodash';
import { toSlug } from '../../utils/slug';
import { isNone } from '../../core/utils';

export const markdownItWikilinkNavigation = (
  md: markdownit,
  workspace: FoamWorkspace,
  options?: { root?: vscode.Uri }
) => {
  return md.use(markdownItRegex, {
    name: 'connect-wikilinks',
    regex: /(?=[^!])\[\[([^[\]]+?)\]\]/,
    replace: (wikilink: string) => {
      try {
        const { target, section, alias } = MarkdownLink.analyzeLink({
          rawText: '[[' + wikilink + ']]',
          type: 'wikilink',
          range: Range.create(0, 0),
          isEmbed: false,
        });

        if (target.length === 0) {
          if (section) {
            const slug = section.startsWith('^')
              ? section.substring(1)
              : toSlug(section);
            const linkText = alias || `#${section}`;
            const title = alias || section;
            return getResourceLink(title, `#${slug}`, linkText);
          }
          return `[[${wikilink}]]`;
        }

        const resource = workspace.find(target);

        if (isNone(resource)) {
          const linkText = alias || wikilink;
          return getPlaceholderLink(linkText);
        }

        // Use upstream's way of creating the base link
        const href = `/${vscode.workspace.asRelativePath(
          toVsCodeUri(resource.uri),
          false
        )}`;

        let linkTitle = resource.title;
        let finalHref = href;

        if (section) {
          linkTitle += `#${section}`;
          const foundSection = resource.sections.find(
            s => toSlug(s.label) === toSlug(section) || s.blockId === section
          );

          let fragment;
          if (foundSection) {
            if (foundSection.isHeading) {
              fragment = foundSection.id;
            } else {
              // It's a block ID. Find the nearest parent heading.
              const parentHeading = resource.sections
                .filter(
                  s =>
                    s.isHeading &&
                    s.range.start.line < foundSection.range.start.line
                )
                .sort((a, b) => b.range.start.line - a.range.start.line)[0];

              fragment = parentHeading ? parentHeading.id : toSlug(section);
            }
          } else {
            fragment = toSlug(section);
          }
          finalHref += `#${fragment}`;
        }

        const linkText = alias || linkTitle;

        return getResourceLink(linkTitle, finalHref, linkText);
      } catch (e) {
        Logger.error('Error while parsing wikilink', e);
        return getPlaceholderLink(wikilink);
      }
    },
  });
};

function getResourceLink(title: string, href: string, text: string) {
  return `<a class='foam-note-link' title='${title}' href='${href}' data-href='${href}'>${text}</a>`;
}

function getPlaceholderLink(text: string) {
  return `<a class='foam-placeholder-link' title="Link to non-existing resource" href="javascript:void(0);">${text}</a>`;
}
