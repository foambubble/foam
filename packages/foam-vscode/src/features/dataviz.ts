import * as vscode from "vscode";
import * as path from "path";
import { FoamFeature } from "../types";
import { Foam, Logger } from "foam-core";
import { TextDecoder } from "util";
import { getTitleMaxLength } from "../settings";
import { isSome } from "../utils";

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext, foamPromise: Promise<Foam>) => {
    vscode.commands.registerCommand("foam-vscode.show-graph", async () => {
      const foam = await foamPromise;
      const panel = await createGraphPanel(foam, context);

      const onFoamChanged = _ => {
        updateGraph(panel, foam);
      };

      const noteAddedListener = foam.notes.onDidAddNote(onFoamChanged);
      const noteUpdatedListener = foam.notes.onDidUpdateNote(onFoamChanged);
      const noteDeletedListener = foam.notes.onDidDeleteNote(onFoamChanged);
      panel.onDidDispose(() => {
        noteAddedListener.dispose();
        noteUpdatedListener.dispose();
        noteDeletedListener.dispose();
      });

      vscode.window.onDidChangeActiveTextEditor(e => {
        if (e.document.uri.scheme === "file") {
          const note = foam.notes.getNote(e.document.uri);
          if (isSome(note)) {
            panel.webview.postMessage({
              type: "didSelectNote",
              payload: note.uri.path
            });
          }
        }
      });
    });
  }
};

function updateGraph(panel: vscode.WebviewPanel, foam: Foam) {
  const graph = generateGraphData(foam);
  panel.webview.postMessage({
    type: "didUpdateGraphData",
    payload: graph
  });
}

function generateGraphData(foam: Foam) {
  const graph = {
    nodes: {},
    edges: new Set()
  };

  foam.notes.getNotes().forEach(n => {
    const links = foam.notes.getForwardLinks(n.uri);
    graph.nodes[n.uri.path] = {
      id: n.uri.path,
      type: "note",
      uri: n.uri,
      title: cutTitle(n.title)
    };
    links.forEach(link => {
      if (!(link.to.path in graph.nodes)) {
        graph.nodes[link.to.path] = {
          id: link.to,
          type: "nonExistingNote",
          uri: `virtual:${link.to}`,
          title: cutTitle(link.link.slug)
        };
      }
      graph.edges.add({
        source: link.from.path,
        target: link.to.path
      });
    });
  });
  return {
    nodes: graph.nodes,
    links: Array.from(graph.edges)
  };
}

function cutTitle(title: string): string {
  const maxLen = getTitleMaxLength();
  if (maxLen > 0 && title.length > maxLen) {
    return title.substring(0, maxLen).concat("...");
  }
  return title;
}

async function createGraphPanel(foam: Foam, context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "foam-graph",
    "Foam Graph",
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  panel.webview.html = await getWebviewContent(context, panel);

  panel.webview.onDidReceiveMessage(
    async message => {
      switch (message.type) {
        case "webviewDidLoad":
          updateGraph(panel, foam);
          break;

        case "webviewDidSelectNode":
          const noteUri = vscode.Uri.parse(message.payload);
          const selectedNote = foam.notes.getNote(noteUri);

          const doc = await vscode.workspace.openTextDocument(
            selectedNote.uri.path // vscode doesn't recognize the URI directly
          );
          vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
          break;

        case "error":
          Logger.error("An error occurred in the graph view", message.payload);
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
  const webviewPath = vscode.Uri.file(
    path.join(context.extensionPath, "static", "dataviz.html")
  );
  const file = await vscode.workspace.fs.readFile(webviewPath);
  const text = new TextDecoder("utf-8").decode(file);

  const webviewUri = (fileName: string) =>
    panel.webview
      .asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, "static", fileName))
      )
      .toString();

  const graphDirectory = path.join("graphs", "default");
  const textWithVariables = text
    .replace(
      "${graphPath}",
      "{{" + path.join(graphDirectory, "graph.js") + "}}"
    )
    .replace(
      "${graphStylesPath}",
      "{{" + path.join(graphDirectory, "graph.css") + "}}"
    );

  // Basic templating. Will replace the script paths with the
  // appropriate webview URI.
  const filled = textWithVariables.replace(
    /<script data-replace src="([^"]+")/g,
    match => {
      const fileName = match
        .slice('<script data-replace src="'.length, -1)
        .trim();
      return '<script src="' + webviewUri(fileName) + '"';
    }
  );

  return filled;
}

export default feature;
