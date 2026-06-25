import * as vscode from 'vscode';
import { URI } from '@foam/core';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { LinkResolver, ResolvedLinkRendering } from './wikilink-navigation';

/**
 * Link resolver for the VS Code markdown preview: hrefs are workspace-relative
 * paths like `/path/to/note.md#fragment`, matching the URL shape the preview
 * webview's click handler understands.
 */
export const createVsCodeLinkResolver = (): LinkResolver => {
  return ({ resource, linkFragment }): ResolvedLinkRendering => {
    const resourceLink = `/${vscode.workspace.asRelativePath(
      toVsCodeUri(resource.uri),
      false
    )}`;
    return { href: `${resourceLink}${linkFragment}` };
  };
};

/**
 * Link resolver for the single-file HTML-page publish target: included notes
 * resolve to intra-document anchors (`#note-<slug>` or, when the wikilink
 * targets a heading, `#note-<slug>--<section-slug>`). Notes not in the
 * published set render as plain text by returning `href: null`.
 *
 * Block-id targets (`[[note#^id]]`) collapse to the note's top anchor — the
 * HTML page doesn't currently emit per-block anchors.
 */
export const createHtmlPageLinkResolver = (
  includedNoteUris: URI[],
  slugFor: (uri: URI) => string
): LinkResolver => {
  const included = new Set(includedNoteUris.map(u => u.toString()));
  return ({ resource, linkFragment }): ResolvedLinkRendering => {
    if (!included.has(resource.uri.toString())) {
      return { href: null };
    }
    const noteAnchor = `note-${slugFor(resource.uri)}`;
    // `linkFragment` is the navigation-side fragment (e.g. `#section-slug`,
    // `#__blockid`, or empty). Section anchors are scoped per-note so we
    // re-attach the section slug; block anchors don't have a target in the
    // report and fall back to the top of the note.
    if (!linkFragment || linkFragment.startsWith('#__')) {
      return { href: `#${noteAnchor}` };
    }
    const sectionSlug = linkFragment.replace(/^#/, '');
    return { href: `#${noteAnchor}--${sectionSlug}` };
  };
};
