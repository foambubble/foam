import * as vscode from "vscode";
import * as path from "path";
import { FoamFeature } from "../types";
import { Foam } from "foam-core";
import { TextDecoder } from "util";

const feature: FoamFeature = {
  activate: async (context: vscode.ExtensionContext, foamPromise: Promise<Foam>) => {
    vscode.commands.registerCommand("foam-vscode.show-graph", async () => {
      const foam = await foamPromise
      const panel = vscode.window.createWebviewPanel(
        "foam-graph",
        "Foam Graph",
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      const graph = {
        nodes: [],
        edges: [],
      };

      foam.notes.getNotes().forEach(n => {
        graph.nodes.push({
          id: n.id,
          type: 'note',
          uri: n.source.uri,
          title: path.basename(n.source.uri),
          nOutLinks: foam.notes.getForwardLinks(n.id).length,
          nInLinks: foam.notes.getBacklinks(n.id).length,
        })
        foam.notes.getForwardLinks(n.id).forEach(link => {
          if (foam.notes.getNote(link.to) == null) {
            graph.nodes.push({
              id: link.to,
              type: 'nonExistingNote',
              uri: 'orphan',
              title: link.link.slug,
              nInLinks: 0,
              nOutLinks: 0,
            })
          }
          graph.edges.push({
            source: link.from,
            target: link.to,
          })
        })
      })

      panel.webview.html = await getWebviewContent(context, panel);

      panel.webview.postMessage({
        type: "refresh",
        payload: graph,
      });
    })
  },
};

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
  const codiconsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'node_modules', 'vscode-codicons', 'dist', 'codicon.css'));
  const codiconsFontUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'node_modules', 'vscode-codicons', 'dist', 'codicon.ttf'));

  const graphDirectory = path.join("graphs", "default");
  const textWithVariables = text
    .replace(
      "${graphPath}",
      "{{" + path.join(graphDirectory, "graph.js") + "}}"
    )
    .replace(
      "${graphStylesPath}",
      "{{" + path.join(graphDirectory, "graph.css") + "}}"
    )
    .replace(
      "${styleUri}",
      codiconsUri.toString()
    )
    .replace(
      "${codiconsUri}",
      codiconsFontUri.toString()
    );

  // Basic templating. Will replace the script paths with the
  // appropriate webview URI.
  const filled = textWithVariables.replace(/<script data-replace src="([^"]+")/g, (match) => {
    const fileName = match.slice("<script data-replace src=\"".length, -1).trim();
    return "<script src=\"" + webviewUri(fileName) + "\"";
  });

  return filled;
}

export default feature
