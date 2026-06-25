/*global markdownit:readonly*/

import markdownItRegex from 'markdown-it-regex';
import { FoamWorkspace } from '@foam/core';
import { Logger } from '@foam/core';
import { MarkdownLink } from '@foam/core';
import { Range } from '@foam/core';
import { Resource } from '@foam/core';
import { escapeHtml } from '@foam/core';
import { isEmpty } from 'lodash';
import { toSlug } from '@foam/core';
import { isNone } from '@foam/core';

/**
 * Per-link render result returned by the host. Plugins shouldn't need to
 * know about VS Code's webview href shape, the report's intra-document
 * anchors, or any other host-specific concern — they just resolve to a
 * resource and ask the host how to render that.
 *
 * All string fields are interpolated into HTML by this plugin, which applies
 * attribute-boundary escaping at the seam — return values verbatim; don't
 * pre-escape.
 */
export interface ResolvedLinkRendering {
  /** href to put on the anchor; null/undefined renders as plain text. */
  href?: string | null;
  /** Extra CSS class(es), space-separated. Defaults to `foam-note-link`. */
  className?: string;
  /** title attribute; defaults to `${resource.title}${formattedFragment}`. */
  title?: string;
  /** Visible label; defaults to alias or `${resource.title}${formattedFragment}`. */
  label?: string;
}

/**
 * Decides how a resolved wikilink should render. `linkFragment` is already
 * normalized (e.g. `#__blockid`, `#section-slug`); `formattedFragment` is the
 * user-facing form (`#^blockid`, `#Section`).
 */
export type LinkResolver = (input: {
  resource: Resource;
  linkFragment: string;
  formattedFragment: string;
  alias: string | undefined;
}) => ResolvedLinkRendering;

export interface WikilinkNavigationOptions {
  linkResolver: LinkResolver;
}

export const markdownItWikilinkNavigation = (
  md: markdownit,
  workspace: FoamWorkspace,
  options: WikilinkNavigationOptions
) => {
  const { linkResolver } = options;
  return md.use(markdownItRegex, {
    name: 'connect-wikilinks',
    regex: /(?=[^!])\[\[([^[\]]+?)\]\]/,
    replace: (wikilink: string) => {
      try {
        const { target, section, blockId, alias } = MarkdownLink.analyzeLink({
          rawText: '[[' + wikilink + ']]',
          type: 'wikilink',
          range: Range.create(0, 0),
          isEmbed: false,
        });
        // formattedFragment is shown to the user in link labels/titles.
        // linkFragment is used in the href — block ids use the '__' prefix to
        // match the id emitted by block-anchor-ids.ts and avoid '^' which is
        // not a valid CSS identifier character.
        const formattedFragment = blockId
          ? `#^${blockId}`
          : section
          ? `#${section}`
          : '';
        const linkFragment = blockId
          ? `#__${blockId}`
          : section
          ? `#${toSlug(section)}`
          : '';
        const label = isEmpty(alias) ? `${target}${formattedFragment}` : alias;

        // [[#section]] and [[#^blockid]] links (same-file self-references)
        if (target.length === 0) {
          // we don't have a good way to check if the section/block exists within
          // the open file, so we just create a regular link for it.
          // Title shows '^blockid' for user clarity; href uses '__blockid' prefix.
          const fragmentTitle = blockId ? `^${blockId}` : section;
          return getResourceLink(fragmentTitle, linkFragment, label);
        }

        const resource = workspace.find(target);
        if (isNone(resource)) {
          return getPlaceholderLink(label);
        }

        const rendering = linkResolver({
          resource,
          linkFragment,
          formattedFragment,
          alias,
        });
        const defaultLabel = isEmpty(alias)
          ? `${resource.title}${formattedFragment}`
          : alias;
        const renderedLabel = rendering.label ?? defaultLabel;
        const renderedTitle =
          rendering.title ?? `${resource.title}${formattedFragment}`;

        if (rendering.href === null || rendering.href === undefined) {
          return renderedLabel;
        }

        // Attribute-boundary escape every host-supplied value: `className`,
        // `renderedTitle`, `rendering.href`, and the visible `renderedLabel`
        // all flow in from the LinkResolver, and a third-party resolver
        // could return any of them with characters that would otherwise
        // close the attribute or inject markup.
        // Attribute-boundary escape every host-supplied value: `className`,
        // `renderedTitle`, `rendering.href`, and the visible `renderedLabel`
        // all flow in from the LinkResolver, and a third-party resolver
        // could return any of them with characters that would otherwise
        // close the attribute or inject markup.
        const className = escapeHtml(rendering.className ?? 'foam-note-link');
        const safeTitle = escapeHtml(renderedTitle);
        const safeHref = escapeHtml(rendering.href);
        const safeLabel = escapeHtml(renderedLabel);
        return `<a class="${className}" title="${safeTitle}" href="${safeHref}" data-href="${safeHref}">${safeLabel}</a>`;
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
  `<a class="foam-placeholder-link" title="Link to non-existing resource" href="javascript:void(0);">${escapeHtml(
    content
  )}</a>`;

const getResourceLink = (title: string, link: string, label: string) => {
  const safeTitle = escapeHtml(title);
  const safeLink = escapeHtml(link);
  return `<a class="foam-note-link" title="${safeTitle}" href="${safeLink}" data-href="${safeLink}">${escapeHtml(
    label
  )}</a>`;
};

export default markdownItWikilinkNavigation;
