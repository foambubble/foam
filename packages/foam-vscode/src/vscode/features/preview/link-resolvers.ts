import * as vscode from 'vscode';
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
