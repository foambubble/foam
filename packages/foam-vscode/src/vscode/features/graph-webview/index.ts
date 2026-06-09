import * as vscode from 'vscode';
import { Foam } from '@foam/core';
import { Logger } from '@foam/core';
import { fromVsCodeUri } from '../../utils/vsc-utils';
import { isSome } from '@foam/core';
import { getFoamVsCodeConfig } from '../../config';
import { buildGraphData } from '@foam/core';
import { getTelemetry } from '../../services/telemetry';
import type {
  GraphStyle,
  GraphViewConfig,
  ShowGraphArgs,
} from '@foam/graph-view/protocol' with { 'resolution-mode': 'import' };

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  let panel: vscode.WebviewPanel | undefined = undefined;
  vscode.workspace.onDidChangeConfiguration(event => {
    if (panel) {
      if (event.affectsConfiguration('foam.graph.style')) {
        const style = getGraphStyle();
        panel.webview.postMessage({
          type: 'didUpdateStyle',
          payload: style,
        });
      }
    }
  });

  const attachPanelListeners = (p: vscode.WebviewPanel, foam: Foam) => {
    const onFoamChanged = _ => {
      updateGraph(p, foam);
    };
    const noteUpdatedListener = foam.graph.onDidUpdate(onFoamChanged);
    const editorListener = vscode.window.onDidChangeActiveTextEditor(e => {
      handleActiveEditorChange(p, foam, e);
    });
    p.onDidDispose(() => {
      noteUpdatedListener.dispose();
      editorListener.dispose();
      panel = undefined;
    });
  };

  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer('foam-graph', {
      async deserializeWebviewPanel(
        webviewPanel: vscode.WebviewPanel,
        _state: unknown
      ) {
        panel = webviewPanel;
        const foam = await foamPromise;
        await setupGraphPanel(webviewPanel, foam, context, undefined);
        attachPanelListeners(webviewPanel, foam);
      },
    })
  );

  vscode.commands.registerCommand(
    'foam-vscode.show-graph',
    async (args?: ShowGraphArgs) => {
      getTelemetry()?.trackCommand('foam-vscode.show-graph');
      const { style, view } = resolveViewStyle(args);
      if (panel) {
        panel.title = view ? `Foam Graph: ${view}` : 'Foam Graph';
        panel.webview.postMessage({ type: 'didUpdateStyle', payload: style });
        panel.reveal();
      } else {
        const foam = await foamPromise;
        panel = await createGraphPanel(foam, context, {
          initialStyle: style,
          view,
        });
        attachPanelListeners(panel, foam);
      }
    }
  );
  const shouldOpenGraphOnStartup = getFoamVsCodeConfig('graph.onStartup');
  if (shouldOpenGraphOnStartup) {
    vscode.commands.executeCommand('foam-vscode.show-graph');
  }
}

function updateGraph(panel: vscode.WebviewPanel, foam: Foam) {
  const graph = generateGraphData(foam);
  panel.webview.postMessage({
    type: 'didUpdateGraphData',
    payload: graph,
  });
}

function generateGraphData(foam: Foam) {
  return buildGraphData(foam.workspace.list(), foam.graph.getAllConnections(), {
    resourceToId: uri => uri.path,
    transformTitle: title => cutTitle(title),
    includePlaceholders: true,
  });
}

function cutTitle(title: string): string {
  const maxLen = vscode.workspace
    .getConfiguration('foam.graph')
    .get('titleMaxLength', 24);
  if (maxLen > 0 && title.length > maxLen) {
    return title.substring(0, maxLen).concat('...');
  }
  return title;
}

async function createGraphPanel(
  foam: Foam,
  context: vscode.ExtensionContext,
  options: { initialStyle?: GraphStyle; view?: string } = {}
) {
  const title = options.view ? `Foam Graph: ${options.view}` : 'Foam Graph';
  const panel = vscode.window.createWebviewPanel(
    'foam-graph',
    title,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  await setupGraphPanel(panel, foam, context, options.initialStyle);
  return panel;
}

async function setupGraphPanel(
  panel: vscode.WebviewPanel,
  foam: Foam,
  context: vscode.ExtensionContext,
  initialStyle?: GraphStyle
) {
  panel.webview.html = await getWebviewContent(context, panel);

  panel.webview.onDidReceiveMessage(
    async message => {
      switch (message.type) {
        case 'webviewDidLoad': {
          const style = initialStyle ?? getGraphStyle();
          panel.webview.postMessage({
            type: 'didUpdateStyle',
            payload: style,
          });

          updateGraph(panel, foam);
          break;
        }
        case 'webviewDidSelectNode': {
          const noteUri = vscode.Uri.parse(message.payload);
          const selectedNote = foam.workspace.get(fromVsCodeUri(noteUri));

          if (isSome(selectedNote)) {
            const navigateToPreview = getFoamVsCodeConfig(
              'graph.navigateToPreview',
              false
            );
            const command = getNodeNavigationCommand(
              noteUri.path,
              navigateToPreview
            );
            if (command === 'markdown.showPreview') {
              vscode.commands.executeCommand(command, noteUri);
            } else {
              vscode.commands.executeCommand(
                command,
                noteUri,
                vscode.ViewColumn.One
              );
            }
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
}

async function getWebviewContent(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel
) {
  const datavizUri = vscode.Uri.joinPath(
    context.extensionUri,
    'static',
    'dataviz'
  );
  const getWebviewUri = (fileName: string) =>
    panel.webview.asWebviewUri(vscode.Uri.joinPath(datavizUri, fileName));

  const indexHtml = new TextDecoder('utf-8').decode(
    await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(datavizUri, 'index.html')
    )
  );

  // Replace the script paths with the appropriate webview URI.
  const filled = indexHtml.replace(
    /data-replace (src|href)="[^"]+"/g,
    match => {
      const i = match.indexOf(' ');
      const j = match.indexOf('=');
      const uri = getWebviewUri(match.slice(j + 2, -1).trim());
      return match.slice(i + 1, j) + '="' + uri.toString() + '"';
    }
  );

  return filled;
}

export function getGraphStyle(): GraphStyle {
  const styleConfig =
    vscode.workspace.getConfiguration('foam.graph').get('style') ?? {};
  return { style: styleConfig };
}

export function viewConfigToStyle(config: GraphViewConfig): GraphStyle {
  const nodeColors = config.show
    ? Object.fromEntries(
        Object.entries(config.show)
          .filter(([, cfg]) => cfg.color)
          .map(([type, cfg]) => [type, cfg.color!])
      )
    : undefined;

  const showNodesOfType = config.show
    ? Object.fromEntries(
        Object.entries(config.show).map(([type, cfg]) => [
          type,
          cfg.enabled ?? true,
        ])
      )
    : undefined;

  const styleProps: Record<string, unknown> = {};
  if (config.background !== undefined)
    styleProps.background = config.background;
  if (config.fontSize !== undefined) styleProps.fontSize = config.fontSize;
  if (config.fontFamily !== undefined)
    styleProps.fontFamily = config.fontFamily;
  if (config.lineColor !== undefined) styleProps.lineColor = config.lineColor;
  if (nodeColors && Object.keys(nodeColors).length > 0)
    styleProps.node = nodeColors;

  return {
    ...(config.colorBy !== undefined ? { colorMode: config.colorBy } : {}),
    ...(config.groups !== undefined ? { groups: config.groups } : {}),
    ...(showNodesOfType !== undefined ? { showNodesOfType } : {}),
    ...(Object.keys(styleProps).length > 0 ? { style: styleProps } : {}),
  };
}

export function mergeStyles(base: GraphStyle, patch: GraphStyle): GraphStyle {
  return {
    colorMode: patch.colorMode ?? base.colorMode,
    groups: patch.groups ?? base.groups,
    showNodesOfType: { ...base.showNodesOfType, ...patch.showNodesOfType },
    style: { ...base.style, ...patch.style },
  };
}

export function resolveViewStyle(args?: ShowGraphArgs): {
  style: GraphStyle;
  view?: string;
} {
  const views: GraphViewConfig[] =
    vscode.workspace.getConfiguration('foam.graph').get('views') ?? [];

  let style: GraphStyle = getGraphStyle();

  // If no view name given and no inline config, fall back to the "Default" named view
  const namedView = args?.view ?? (args?.config ? undefined : 'Default');

  if (namedView) {
    const view = views.find(v => v.name === namedView);
    if (view) {
      style = mergeStyles(style, viewConfigToStyle(view));
    }
  }

  if (args?.config) {
    style = mergeStyles(style, viewConfigToStyle(args.config));
  }

  return { style, view: args?.view };
}

export function handleActiveEditorChange(
  panel: vscode.WebviewPanel | undefined,
  foam: Foam,
  e: vscode.TextEditor | undefined
) {
  if (panel && e?.document?.uri && e.document.uri.scheme !== 'untitled') {
    const note = foam.workspace.get(fromVsCodeUri(e.document.uri));
    if (isSome(note)) {
      panel.webview.postMessage({
        type: 'didSelectNote',
        payload: note.uri.path,
      });
    }
  }
}

export function getNodeNavigationCommand(
  uriPath: string,
  navigateToPreview: boolean
): string {
  if (navigateToPreview && uriPath.endsWith('.md')) {
    return 'markdown.showPreview';
  }
  return 'vscode.open';
}
