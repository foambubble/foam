import * as vscode from "vscode";
import * as path from "path";
import { FoamFeature } from "../types";
import { Foam } from "foam-core";
import { TextDecoder } from "util";
import { getTitleMaxLength } from "../settings";

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext, foamPromise: Promise<Foam>) => {
    vscode.commands.registerCommand("foam-vscode.show-graph", async () => {
      const foam = await foamPromise;
      const panel = await createGraphPanel(foam, context);

      const onNoteAdded = _ => {
        updateGraph(panel, foam);
      };

      foam.notes.unstable_onNoteAdded(onNoteAdded);
      panel.onDidDispose(() => {
        foam.notes.unstable_removeEventListener(onNoteAdded);
      });

      updateGraph(panel, foam);
    });
  }
};

function updateGraph(panel: vscode.WebviewPanel, foam: Foam) {
  const graph = generateGraphData(foam);
  panel.webview.postMessage({
    type: "refresh",
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
      title: cutTitle(n.title),
      nOutLinks: links.length,
      nInLinks: graph.nodes[n.id]?.nInLinks ?? 0
    };
    links.forEach(link => {
      if (!(link.to in graph.nodes)) {
        graph.nodes[link.to] = {
          id: link.to,
          type: "nonExistingNote",
          uri: "orphan",
          title: link.link.slug,
          nOutLinks: graph.nodes[link.to]?.nOutLinks ?? 0,
          nInLinks: graph.nodes[link.to]?.nInLinks + 1 ?? 0
        };
      }
      graph.edges.add({
        source: link.from,
        target: link.to
      });
    });
  });
  return {
    nodes: Array.from(Object.values(graph.nodes)),
    edges: Array.from(graph.edges)
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
      if (message.type === "selected") {
        const noteId = message.payload;
        const noteUri = foam.notes.getNote(noteId).source.uri;
        const openPath = vscode.Uri.file(noteUri);

        vscode.workspace.openTextDocument(openPath).then(doc => {
          vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
        });
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
