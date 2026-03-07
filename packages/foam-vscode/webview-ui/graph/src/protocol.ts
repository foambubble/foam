/**
 * Shared message types between the extension host and the graph webview.
 * This file must remain free of VS Code and Node.js imports.
 */

export type NodeType =
  | 'note'
  | 'tag'
  | 'placeholder'
  | 'image'
  | 'attachment'
  | string;

export interface NodeInfo {
  id: string;
  type: NodeType;
  title: string;
  properties: { color?: string; [key: string]: unknown };
  tags: Array<{ label: string }>;
}

export interface GraphData {
  nodeInfo: Record<string, NodeInfo>;
  links: Array<{ source: string; target: string }>;
}

export interface StyleConfig {
  background?: string;
  fontSize?: number;
  fontFamily?: string;
  lineColor?: string;
  lineWidth?: number;
  particleWidth?: number;
  highlightedForeground?: string;
  node?: {
    note?: string;
    placeholder?: string;
    tag?: string;
    [key: string]: string | undefined;
  };
}

/**
 * The payload for the didUpdateStyle message.
 * Matches the shape of the foam.graph.style VS Code configuration object.
 */
export interface StylePayload {
  style?: StyleConfig;
  colorMode?: 'none' | 'directory';
}

// Extension → Webview
export type ExtensionMessage =
  | { type: 'didUpdateStyle'; payload: StylePayload }
  | { type: 'didUpdateGraphData'; payload: GraphData }
  | { type: 'didSelectNote'; payload: string };

// Webview → Extension
export type WebviewMessage =
  | { type: 'webviewDidLoad' }
  | { type: 'webviewDidSelectNode'; payload: string }
  | {
      type: 'error';
      payload: {
        message: string;
        filename: string;
        lineno: number;
        colno: number;
        error?: unknown;
      };
    };
