import * as vscode from 'vscode';
import { Foam, URI } from '@foam/core';
import { Logger } from '@foam/core';
import { fromVsCodeUri } from '../../utils/vsc-utils';
import { isSome } from '@foam/core';
import { getFoamVsCodeConfig } from '../../config';
import { getActiveTabUri, onDidChangeActiveTab } from '../../services/editor';
import { buildGraphData } from '@foam/core';
import { getTelemetry } from '../../services/telemetry';
import type {
  GraphStyle,
  GraphViewConfig,
  ShowGraphArgs,
  WebviewMessage,
} from '@foam/graph-view/protocol' with { 'resolution-mode': 'import' };
import { getViewState, saveViewState } from './view-state-store';

const GRAPH_PANEL_TITLE = 'Foam Graph';
const GRAPH_PANEL_TITLE_PREFIX = `${GRAPH_PANEL_TITLE}: `;

export function graphPanelTitle(view?: string): string {
  return view ? `${GRAPH_PANEL_TITLE_PREFIX}${view}` : GRAPH_PANEL_TITLE;
}

/**
 * The view a panel is showing, recovered from its title — the serializer
 * restores the title across window reloads but passes no view argument.
 * A nameless panel maps to the `Default` bucket, the same named view
 * `resolveViewStyle` falls back to.
 */
export function viewNameFromPanelTitle(title: string): string {
  return title.startsWith(GRAPH_PANEL_TITLE_PREFIX)
    ? title.slice(GRAPH_PANEL_TITLE_PREFIX.length)
    : 'Default';
}

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  let panel: vscode.WebviewPanel | undefined = undefined;
  // The show-graph arguments the open panel's style was resolved from, so a
  // settings edit can re-resolve the same view instead of the bare base style.
  let panelArgs: ShowGraphArgs | undefined = undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (panel && event.affectsConfiguration('foam.graph.style')) {
        postRestyledView(panel, panelArgs);
      }
    })
  );

  const attachPanelListeners = (p: vscode.WebviewPanel, foam: Foam) => {
    const onFoamChanged = _ => {
      updateGraph(p, foam);
    };
    const noteUpdatedListener = foam.graph.onDidUpdate(onFoamChanged);
    const editorListener = onDidChangeActiveTab(() => {
      handleActiveResourceChange(p, foam, getActiveTabUri(foam.workspace));
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
        panelArgs = { view: viewNameFromPanelTitle(webviewPanel.title) };
        const foam = await foamPromise;
        await setupGraphPanel(webviewPanel, foam, context, undefined);
        attachPanelListeners(webviewPanel, foam);
      },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'foam-vscode.show-graph',
      async (args?: ShowGraphArgs) => {
        getTelemetry()?.trackCommand('foam-vscode.show-graph');
        const { style, view } = resolveViewStyle(args);
        panelArgs = args;
        if (panel) {
          retargetGraphPanel(panel, context.workspaceState, style, view);
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
    )
  );
  const shouldOpenGraphOnStartup = getFoamVsCodeConfig('graph.onStartup');
  if (shouldOpenGraphOnStartup) {
    vscode.commands.executeCommand('foam-vscode.show-graph');
  }
}

/** Re-sends the open view's style after a settings edit. */
export function postRestyledView(
  panel: vscode.WebviewPanel,
  args: ShowGraphArgs | undefined
) {
  panel.webview.postMessage({
    type: 'didUpdateStyle',
    payload: resolveViewStyle(args).style,
  });
}

/**
 * Points a live panel at a (possibly different) view: title, declared
 * style, and — only when the view actually changed — that view's saved
 * state. Re-invoking the same view sends no restore, so an in-flight
 * interaction is not snapped back to stale saved state.
 */
export function retargetGraphPanel(
  panel: vscode.WebviewPanel,
  memento: vscode.Memento,
  style: GraphStyle,
  view: string | undefined
) {
  const previousView = viewNameFromPanelTitle(panel.title);
  const nextView = view ?? 'Default';
  panel.title = graphPanelTitle(view);
  panel.webview.postMessage({ type: 'didUpdateStyle', payload: style });
  if (nextView !== previousView) {
    panel.webview.postMessage({
      type: 'didRestoreViewState',
      payload: {
        viewName: nextView,
        state: getViewState(memento, nextView) ?? {},
      },
    });
  }
}

export function updateGraph(panel: vscode.WebviewPanel, foam: Foam) {
  const graph = generateGraphData(foam);
  panel.webview.postMessage({
    type: 'didUpdateGraphData',
    payload: graph,
  });
}

function generateGraphData(foam: Foam) {
  // Titles are sent in full; the webview truncates labels at render time.
  return buildGraphData(foam.workspace.list(), foam.graph.getAllConnections(), {
    resourceToId: uri => uri.path,
    includePlaceholders: true,
  });
}

async function createGraphPanel(
  foam: Foam,
  context: vscode.ExtensionContext,
  options: { initialStyle?: GraphStyle; view?: string } = {}
) {
  const panel = vscode.window.createWebviewPanel(
    'foam-graph',
    graphPanelTitle(options.view),
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
    createWebviewMessageHandler(
      panel,
      foam,
      context.workspaceState,
      initialStyle
    ),
    undefined,
    context.subscriptions
  );
}

export function createWebviewMessageHandler(
  panel: vscode.WebviewPanel,
  foam: Foam,
  memento: vscode.Memento,
  initialStyle?: GraphStyle
) {
  return async (message: WebviewMessage) => {
    switch (message.type) {
      case 'webviewDidLoad': {
        const viewName = viewNameFromPanelTitle(panel.title);
        // a deserialized panel has no initialStyle; resolve the view it
        // was showing (from the title) so its declared config survives a
        // window reload like its saved state does
        const style =
          initialStyle ?? resolveViewStyle({ view: viewName }).style;
        panel.webview.postMessage({
          type: 'didUpdateStyle',
          payload: style,
        });

        // always sent: it also tells the webview which view later
        // changes belong to
        panel.webview.postMessage({
          type: 'didRestoreViewState',
          payload: { viewName, state: getViewState(memento, viewName) ?? {} },
        });

        updateGraph(panel, foam);
        break;
      }
      case 'webviewDidChangeViewState': {
        await saveViewState(
          memento,
          message.payload.viewName ?? viewNameFromPanelTitle(panel.title),
          message.payload.state
        );
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
  };
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

  // an empty view name means no view name
  const viewName = args?.view || undefined;
  // If no view name given and no inline config, fall back to the "Default" named view
  const namedView = viewName ?? (args?.config ? undefined : 'Default');

  if (namedView) {
    const view = views.find(v => v.name === namedView);
    if (view) {
      style = mergeStyles(style, viewConfigToStyle(view));
    }
  }

  if (args?.config) {
    style = mergeStyles(style, viewConfigToStyle(args.config));
  }

  return { style, view: viewName };
}

export function handleActiveResourceChange(
  panel: vscode.WebviewPanel | undefined,
  foam: Foam,
  uri: URI | undefined
) {
  if (panel && uri && uri.scheme !== 'untitled') {
    const note = foam.workspace.find(uri);
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
