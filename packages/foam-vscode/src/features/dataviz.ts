import * as vscode from "vscode";
import * as path from "path";
import { FoamFeature } from "../types";
import { Foam } from "foam-core";
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
      panel.onDidDispose(() => {
        noteAddedListener.dispose();
        noteUpdatedListener.dispose();
      });

      vscode.window.onDidChangeActiveTextEditor(e => {
        if (e.document.uri.scheme === "file") {
          const note = foam.notes.getNoteByURI(e.document.uri.fsPath);
          if (isSome(note)) {
            panel.webview.postMessage({
              type: "didSelectNote",
              payload: note.id
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
    const links = foam.notes.getForwardLinks(n.id);
    graph.nodes[n.id] = {
      id: n.id,
      type: "note",
      uri: n.source.uri,
      title: cutTitle(n.title)
    };
    links.forEach(link => {
      if (!(link.to in graph.nodes)) {
        graph.nodes[link.to] = {
          id: link.to,
          type: "nonExistingNote",
          uri: `virtual:${link.to}`,
          title: link.link.slug
        };
      }
      graph.edges.add({
        source: link.from,
        target: link.to
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
    message => {
      switch (message.type) {
        case "webviewDidLoad":
          updateGraph(panel, foam);
          break;

        case "webviewDidSelectNode":
          const noteId = message.payload;
          const noteUri = foam.notes.getNote(noteId).source.uri;
          const openPath = vscode.Uri.file(noteUri);

          vscode.workspace.openTextDocument(openPath).then(doc => {
            vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
          });
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
