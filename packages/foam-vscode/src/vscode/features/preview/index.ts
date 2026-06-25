/*global markdownit:readonly*/

import * as vscode from 'vscode';
import { Foam, URI, createRenderContext } from '@foam/core';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { createFoamMarkdownIt } from './foam-markdown-it';
import { createVsCodeLinkResolver } from './link-resolvers';
import { getFoamVsCodeConfig } from '../../config';
import { isVirtualWorkspace } from '../../services/editor';
import { CONFIG_EMBED_NOTE_TYPE } from './wikilink-embed';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  // Refresh the markdown preview whenever the workspace changes so that
  // foam-query embed blocks show up-to-date results in real time.
  context.subscriptions.push(
    foam.workspace.onDidAdd(() =>
      vscode.commands.executeCommand('markdown.preview.refresh')
    ),
    foam.workspace.onDidUpdate(() =>
      vscode.commands.executeCommand('markdown.preview.refresh')
    ),
    foam.workspace.onDidDelete(() =>
      vscode.commands.executeCommand('markdown.preview.refresh')
    )
  );

  return {
    extendMarkdownIt: (md: markdownit) => {
      const ws = foam.workspace;
      const graph = foam.graph;
      const parser = foam.services.parser;

      // One render context per `extendMarkdownIt` call — shared between the
      // embed and query plugins so embed↔query cycles get caught.
      const renderContext = createRenderContext();

      // For `$current` in foam-query and for self-fragment embeds. The
      // context's top wins so a foam-query inside note B's body sees B,
      // not the active editor's note.
      const getCurrentResource = () => {
        const stack = renderContext.current();
        if (stack.length > 0) {
          return ws.find(stack[stack.length - 1]) ?? null;
        }
        const editor = vscode.window.activeTextEditor;
        return editor ? ws.find(fromVsCodeUri(editor.document.uri)) : null;
      };

      return createFoamMarkdownIt(
        {
          workspace: ws,
          graph,
          parser,
          linkResolver: createVsCodeLinkResolver(),
          getCurrentResource,
          isTrusted: () => vscode.workspace.isTrusted,
          // Build the full href shape the preview webview expects:
          // a leading-slash workspace-relative path, percent-encoded.
          // The URI's fragment is dropped here because foam-query result
          // titles always link to the note as a whole — they don't carry a
          // section target. If that changes, append `#${uri.fragment}`.
          toHref: (uri: URI) =>
            encodeURI(
              `/${vscode.workspace.asRelativePath(toVsCodeUri(uri), false)}`
            ),
          isVirtualWorkspace: () => isVirtualWorkspace(),
          getEmbedNoteType: () =>
            getFoamVsCodeConfig<string>(CONFIG_EMBED_NOTE_TYPE),
          renderContext,
        },
        md
      );
    },
  };
}
