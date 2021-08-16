import * as vscode from 'vscode';
import * as path from 'path';
import { FoamFeature } from '../types';
import { Foam, Logger, URI } from 'foam-core';
import { TextDecoder } from 'util';
import { getGraphStyle, getTitleMaxLength } from '../settings';
import { isSome } from '../utils';

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

        const noteAddedListener = foam.workspace.onDidAdd(onFoamChanged);
        const noteUpdatedListener = foam.workspace.onDidUpdate(onFoamChanged);
        const noteDeletedListener = foam.workspace.onDidDelete(onFoamChanged);
        panel.onDidDispose(() => {
          noteAddedListener.dispose();
          noteUpdatedListener.dispose();
          noteDeletedListener.dispose();
          panel = undefined;
        });

        vscode.window.onDidChangeActiveTextEditor(e => {
          if (e.document.uri.scheme === 'file') {
            const note = foam.workspace.get(e.document.uri);
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
    nodes: {},
    edges: new Set(),
  };

  foam.workspace.list().forEach(n => {
    const type = n.type === 'note' ? n.properties.type ?? 'note' : n.type;
    const title = n.type === 'note' ? n.title : path.basename(n.uri.path);
    graph.nodes[n.uri.path] = {
      id: n.uri.path,
      type: type,
      uri: n.uri,
      title: cutTitle(title),
    };
  });
  foam.graph.getAllConnections().forEach(c => {
    graph.edges.add({
      source: c.source.path,
      target: c.target.path,
    });
    if (URI.isPlaceholder(c.target)) {
      graph.nodes[c.target.path] = {
        id: c.target.path,
        type: 'placeholder',
        uri: c.target,
        title: c.target.path,
      };
    }
  });

  return {
    nodes: graph.nodes,
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
        case 'webviewDidLoad':
          const styles = getGraphStyle();
          panel.webview.postMessage({
            type: 'didUpdateStyle',
            payload: styles,
          });
          updateGraph(panel, foam);
          break;

        case 'webviewDidSelectNode':
          const noteUri = vscode.Uri.parse(message.payload);
          const selectedNote = foam.workspace.get(noteUri);

          if (isSome(selectedNote)) {
            const doc = await vscode.workspace.openTextDocument(
              selectedNote.uri.path // vscode doesn't recognize the URI directly
            );
            vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
          }
          break;

        case 'error':
          Logger.error('An error occurred in the graph view', message.payload);
          break;
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
  const datavizPath = [context.extensionPath, 'static', 'dataviz'];

  const getWebviewUri = (fileName: string) =>
    panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(...datavizPath, fileName))
    );

  const indexHtml = await vscode.workspace.fs.readFile(
    vscode.Uri.file(path.join(...datavizPath, 'index.html'))
  );

  // Replace the script paths with the appropriate webview URI.
  const filled = new TextDecoder('utf-8')
    .decode(indexHtml)
    .replace(/<script data-replace src="([^"]+")/g, match => {
      const fileName = match
        .slice('<script data-replace src="'.length, -1)
        .trim();
      return '<script src="' + getWebviewUri(fileName).toString() + '"';
    });

  return filled;
}

export default feature;
