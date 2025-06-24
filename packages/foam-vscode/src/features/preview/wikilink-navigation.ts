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

/**
 * A markdown-it plugin that converts [[wikilinks]] to navigable links in the Markdown preview.
 * It handles links to notes, sections, and block IDs, generating the correct hrefs
 * for navigation within the VS Code preview panel.
 *
 * @param md The markdown-it instance.
 * @param workspace The Foam workspace to resolve links against.
 * @param options Optional configuration.
 */
export const markdownItWikilinkNavigation = (
  md: markdownit,
  workspace: FoamWorkspace,
  options?: { root?: vscode.Uri }
) => {
  return md.use(markdownItRegex, {
    name: 'connect-wikilinks',
    // Regex to match a wikilink, ensuring it's not an image/embed (which starts with '!')
    regex: /(?=[^!])\[\[([^[\]]+?)\]\]/,
    // The replacement function that turns a matched wikilink string into an HTML <a> tag.
    replace: (wikilink: string) => {
      try {
        // Deconstruct the wikilink into its constituent parts.
        const { target, section, alias } = MarkdownLink.analyzeLink({
          rawText: '[[' + wikilink + ']]',
          type: 'wikilink',
          range: Range.create(0, 0),
          isEmbed: false,
        });

        // Case 1: The wikilink points to a section/block in the *current* file.
        if (target.length === 0) {
          if (section) {
            // For block IDs (^block-id), the slug is the ID itself. For headings, it's a slugified version.
            const slug = section.startsWith('^')
              ? section.substring(1)
              : toSlug(section);
            const linkText = alias || `#${section}`;
            const title = alias || section;
            // The href is just the fragment identifier.
            return getResourceLink(title, `#${slug}`, linkText);
          }
          // If there's no target and no section, it's a malformed link. Return as is.
          return `[[${wikilink}]]`;
        }

        // Case 2: The wikilink points to another note.
        const resource = workspace.find(target);

        // If the target note doesn't exist, create a "placeholder" link.
        if (isNone(resource)) {
          const linkText = alias || wikilink;
          return getPlaceholderLink(linkText);
        }

        // If the target note exists, construct the link to it.
        // The base href points to the file path of the target resource.
        const href = `/${vscode.workspace.asRelativePath(
          toVsCodeUri(resource.uri),
          false
        )}`;

        let linkTitle = resource.title;
        let finalHref = href;

        // If the link includes a section or block ID part (e.g., [[note#section]] or [[note#^block-id]])
        if (section) {
          linkTitle += `#${section}`;
          // Find the corresponding section or block in the target resource.
          // This lookup works for both heading labels (by comparing slugs) and block IDs (by direct match).
          const foundSection = resource.sections.find(
            s => toSlug(s.label) === toSlug(section) || s.blockId === section
          );

          let fragment;
          if (foundSection) {
            // If the link points to a heading, the fragment is the heading's generated ID.
            if (foundSection.isHeading) {
              fragment = foundSection.id;
            } else {
              // If the link points to a block ID, we need to find the nearest parent heading
              // to use as the navigation anchor. This ensures that clicking the link scrolls
              // to the correct area in the preview.
              const parentHeading = resource.sections
                .filter(
                  s =>
                    s.isHeading &&
                    s.range.start.line < foundSection.range.start.line
                )
                // Sort headings by line number descending to find the closest one *before* the block.
                .sort((a, b) => b.range.start.line - a.range.start.line)[0];

              // Use the parent heading's ID if found; otherwise, fall back to a slug of the block ID.
              fragment = parentHeading ? parentHeading.id : toSlug(section);
            }
          } else {
            // If no specific section is found, fall back to a slug of the section identifier.
            fragment = toSlug(section);
          }
          // Append the fragment to the base href.
          finalHref += `#${fragment}`;
        }

        // The visible text of the link is the alias if provided, otherwise the generated link title.
        const linkText = alias || linkTitle;

        return getResourceLink(linkTitle, finalHref, linkText);
      } catch (e) {
        Logger.error('Error while parsing wikilink', e);
        // Fallback for any errors during processing.
        return getPlaceholderLink(wikilink);
      }
    },
  });
};

/**
 * Generates an HTML <a> tag for a valid, resolved link.
 * Includes data-href for compatibility with VS Code's link-following logic.
 */
function getResourceLink(title: string, href: string, text: string) {
  return `<a class='foam-note-link' title='${title}' href='${href}' data-href='${href}'>${text}</a>`;
}

/**
 * Generates a disabled-style HTML <a> tag for a link to a non-existent note.
 */
function getPlaceholderLink(text: string) {
  return `<a class='foam-placeholder-link' title="Link to non-existing resource" href="javascript:void(0);">${text}</a>`;
}
