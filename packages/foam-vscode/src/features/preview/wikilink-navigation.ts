/*global markdownit:readonly*/

import markdownItRegex from 'markdown-it-regex';
import * as vscode from 'vscode';
import { FoamWorkspace } from '../../core/model/workspace';
import { Logger } from '../../core/utils/log';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { MarkdownLink } from '../../core/services/markdown-link';
import { Position } from '../../core/model/position';
import { Range } from '../../core/model/range';
import { isEmpty } from 'lodash';
import { toSlug } from '../../utils/slug';
import { isNone, isSome } from '../../core/utils';
import { Resource, Section } from '../../core/model/note';

export const markdownItWikilinkNavigation = (
  md: markdownit,
  workspace: FoamWorkspace
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
        const formattedSection = section ? `#${section}` : '';
        const linkSection = section ? `#${toSlug(section)}` : '';
        const label = isEmpty(alias) ? `${target}${formattedSection}` : alias;

        // [[#section]] links
        if (target.length === 0) {
          // we don't have a good way to check if the section exists within the
          // open file, so we just create a regular link for it
          return getResourceLink(section, linkSection, label);
        }

        const resource = workspace.find(target);
        if (isNone(resource)) {
          return getPlaceholderLink(wikilink);
        }

        // Create a sorted copy of the sections array to work with
        const sortedSections = [...resource.sections].sort((a, b) =>
          Position.compareTo(a.range.start, b.range.start)
        );

        let resolvedSectionId: string | undefined;
        const isBlockIdLink = section && section.startsWith('^');

        let foundSection: Section | undefined;
        if (isBlockIdLink) {
          foundSection = sortedSections.find(s => s.blockId === section);
        } else if (section) {
          foundSection = sortedSections.find(
            s => s.isHeading && toSlug(s.label) === toSlug(section)
          );
        }

        if (isSome(foundSection)) {
          if (foundSection.isHeading) {
            // If the found section is a heading and has both a slug-based ID and a block ID,
            // we must construct the combined anchor ID that markdown-it-anchor creates.
            if (foundSection.id && foundSection.blockId) {
              const cleanBlockId = foundSection.blockId.substring(1); // remove the '^'
              resolvedSectionId = `${foundSection.id}-${cleanBlockId}`;
            } else {
              // For headings without block IDs, the section's `id` is the correct anchor.
              resolvedSectionId = foundSection.id;
            }
          } else {
            // This is a non-heading block with an ID.
            // We need to find the nearest preceding heading.
            if (foundSection.blockId) {
              const cleanBlockId = foundSection.blockId.substring(1); // remove the '^'
              const foundSectionIndex = sortedSections.findIndex(
                s =>
                  s.blockId === foundSection.blockId &&
                  Position.isEqual(s.range.start, foundSection.range.start)
              );

              let parentHeading: Section | undefined;
              if (foundSectionIndex !== -1) {
                for (let i = foundSectionIndex - 1; i >= 0; i--) {
                  if (sortedSections[i].isHeading) {
                    parentHeading = sortedSections[i];
                    break;
                  }
                }
              }

              if (isSome(parentHeading) && parentHeading.id) {
                // The link should resolve to the full anchor of the parent heading.
                // Construct the parent's composite ID if it has its own blockId.
                if (parentHeading.blockId) {
                  const cleanParentBlockId = parentHeading.blockId.substring(1);
                  resolvedSectionId = `${parentHeading.id}-${cleanParentBlockId}`;
                } else {
                  // Otherwise, just use the parent's slug-based id.
                  resolvedSectionId = parentHeading.id;
                }
              } else {
                // Fallback: if no parent heading found, use the block's own ID.
                // This might happen for blocks at the top of a file.
                resolvedSectionId = foundSection.id;
              }
            } else {
              // This case should ideally not happen if isBlockIdLink was true,
              // but as a safeguard, use the section's ID if blockId is missing.
              resolvedSectionId = foundSection.id;
            }
          }
        }

        const linkHref = `/${vscode.workspace.asRelativePath(
          toVsCodeUri(resource.uri),
          false
        )}${resolvedSectionId ? `#${resolvedSectionId}` : ''}`;
        const linkTitle = wikilink;
        const linkLabel = wikilink;

        return getResourceLink(linkTitle, linkHref, linkLabel);
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

const getResourceLink = (title: string, link: string, label: string) =>
  `<a class='foam-note-link' title='${title}' href='${link}' data-href='${link}'>${label}</a>`;

export default markdownItWikilinkNavigation;
