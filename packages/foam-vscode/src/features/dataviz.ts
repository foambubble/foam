import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { TextDecoder } from 'util';
import { getGraphStyle, getTitleMaxLength } from '../settings';
import { isSome } from '../utils';
import { Foam } from '../core/model/foam';
import { Logger } from '../core/utils/log';
import { fromVsCodeUri } from '../utils/vsc-utils';

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext, foamPromise: Promise<Foam>) => {
    let panel: vscode.WebviewPanel | undefined = undefined;
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('foam.graph.style')) {
        const style = getGraphStyle();
        panel.webview.postMessage({
          type: 'didUpdateStyle',
          payload: style,
        });
      }
    });

    vscode.commands.registerCommand('foam-vscode.show-graph', async () => {
      if (panel) {
        const columnToShowIn = vscode.window.activeTextEditor
          ? vscode.window.activeTextEditor.viewColumn
          : undefined;
        panel.reveal(columnToShowIn);
      } else {
        const foam = await foamPromise;
        panel = await createGraphPanel(foam, context);
        const onFoamChanged = _ => {
          updateGraph(panel, foam);
        };

        const noteUpdatedListener = foam.graph.onDidUpdate(onFoamChanged);
        panel.onDidDispose(() => {
          noteUpdatedListener.dispose();
          panel = undefined;
        });

        vscode.window.onDidChangeActiveTextEditor(e => {
          if (e?.document?.uri?.scheme === 'file') {
            const note = foam.workspace.get(fromVsCodeUri(e.document.uri));
            if (isSome(note)) {
              panel.webview.postMessage({
                type: 'didSelectNote',
                payload: note.uri.path,
              });
            }
          }
        });
      }
    });
  },
};

function updateGraph(panel: vscode.WebviewPanel, foam: Foam) {
  const graph = generateGraphData(foam);
  panel.webview.postMessage({
    type: 'didUpdateGraphData',
    payload: graph,
  });
}

function generateGraphData(foam: Foam) {
  const graph = {
    nodeInfo: {},
    edges: new Set(),
  };

  foam.workspace.list().forEach(n => {
    const type = n.type === 'note' ? n.properties.type ?? 'note' : n.type;
    const title = n.type === 'note' ? n.title : n.uri.getBasename();
    graph.nodeInfo[n.uri.path] = {
      id: n.uri.path,
      type: type,
      uri: n.uri,
      title: cutTitle(title),
      properties: n.properties,
      tags: n.tags,
    };
  });
  foam.graph.getAllConnections().forEach(c => {
    graph.edges.add({
      source: c.source.path,
      target: c.target.path,
    });
    if (c.target.isPlaceholder()) {
      graph.nodeInfo[c.target.path] = {
        id: c.target.path,
        type: 'placeholder',
        uri: c.target,
        title: c.target.path,
        properties: {},
      };
    }
  });

  return {
    nodeInfo: graph.nodeInfo,
    links: Array.from(graph.edges),
  };
}

function cutTitle(title: string): string {
  const maxLen = getTitleMaxLength();
  if (maxLen > 0 && title.length > maxLen) {
    return title.substring(0, maxLen).concat('...');
  }
  return title;
}

async function createGraphPanel(foam: Foam, context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'foam-graph',
    'Foam Graph',
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  panel.webview.html = await getWebviewContent(context, panel);

  panel.webview.onDidReceiveMessage(
    async message => {
      switch (message.type) {
        case 'webviewDidLoad': {
          const styles = getGraphStyle();
          panel.webview.postMessage({
            type: 'didUpdateStyle',
            payload: styles,
          });
          updateGraph(panel, foam);
          break;
        }
        case 'webviewDidSelectNode': {
          const noteUri = vscode.Uri.parse(message.payload);
          const selectedNote = foam.workspace.get(fromVsCodeUri(noteUri));

          if (isSome(selectedNote)) {
            const doc = await vscode.workspace.openTextDocument(
              selectedNote.uri.path // vscode doesn't recognize the URI directly
            );
            vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
          }
          break;
        }
        case 'error': {
          Logger.error('An error occurred in the graph view', message.payload);
          break;
        }
      }
    },
    undefined,
    context.subscriptions
  );

  return panel;
}

async function getWebviewContent(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel
) {
  const datavizPath = vscode.Uri.joinPath(
    vscode.Uri.file(context.extensionPath),
    'static',
    'dataviz'
  );

  const getWebviewUri = (fileName: string) =>
    panel.webview.asWebviewUri(vscode.Uri.joinPath(datavizPath, fileName));

  const indexHtml = await vscode.workspace.fs.readFile(
    vscode.Uri.joinPath(datavizPath, 'index.html')
  );

  // Replace the script paths with the appropriate webview URI.
  const filled = new TextDecoder('utf-8')
    .decode(indexHtml)
    .replace(/data-replace (src|href)="[^"]+"/g, match => {
      const i = match.indexOf(' ');
      const j = match.indexOf('=');
      const uri = getWebviewUri(match.slice(j + 2, -1).trim());
      return match.slice(i + 1, j) + '="' + uri.toString() + '"';
    });

  return filled;
}

export default feature;
