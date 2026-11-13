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

export type GroupMatchProperty = 'type' | 'path' | 'tag' | 'title' | string;

export interface GroupMatch {
  property: GroupMatchProperty;
  value: string;
}

export interface GroupRule {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
  match: GroupMatch;
}

export interface GraphStyle {
  style?: StyleConfig;
  colorMode?: 'none' | 'directory' | 'type';
  groups?: GroupRule[];
  showNodesOfType?: Record<string, boolean>;
}

export interface Forces {
  collide: number;
  repel: number;
  link: number;
  velocityDecay: number;
}

export type LinkAnimation = 'forward' | 'off' | 'reverse';

export type GraphScope = 'full' | { depth: number };

export type Labels = 'always' | { fade: number };

export interface Selection {
  neighborDepth: number;
  centerOnSelect: boolean;
  zoomOnSelect: boolean;
}

/**
 * The graph view's interactive display state, persisted by the host
 * per view name. Every field is optional: a restore applies only what is
 * present, and the host's store preserves fields it does not know, so
 * entries can be added here without a storage migration.
 */
export interface GraphViewState {
  showNodesOfType?: Record<string, boolean>;
  groups?: GroupRule[];
  localStylePatch?: GraphStyle;
  labels?: Labels;
  forces?: Forces;
  selection?: Selection;
  graphScope?: GraphScope;
  nodeFontSizeMultiplier?: number;
  nodeSizeMultiplier?: number;
  linkWidthMultiplier?: number;
  animateLinks?: LinkAnimation;
  labelMaxLength?: number;
}

/** Config for a built-in special type (tag, attachment, image, placeholder) */
export interface BuiltinTypeConfig {
  enabled?: boolean;
  color?: string;
}

/**
 * A named, pre-configured graph view.
 * Also used as raw command args for `foam-vscode.show-graph`.
 * Merge order: foam.graph.style → named view → inline config.
 */
export interface GraphViewConfig {
  name?: string;
  colorBy?: 'none' | 'directory' | 'type';
  groups?: GroupRule[];
  /** Visibility and color for built-in types: tag, attachment, image, placeholder */
  show?: Record<string, BuiltinTypeConfig>;
  background?: string;
  fontSize?: number;
  fontFamily?: string;
  lineColor?: string;
}

export interface ShowGraphArgs {
  view?: string;
  config?: GraphViewConfig;
}

// Extension → Webview
export type ExtensionMessage =
  | { type: 'didUpdateStyle'; payload: GraphStyle }
  | { type: 'didUpdateGraphData'; payload: GraphData }
  // Always sent when a view is (re)opened, even with an empty state: it
  // resets the interactive state, so one view's tweaks cannot leak into
  // another. viewName tells the webview which bucket later changes belong
  // to, so a save debounced across a view switch cannot land in the wrong
  // bucket.
  | {
      type: 'didRestoreViewState';
      payload: { viewName: string; state: GraphViewState };
    }
  | { type: 'didSelectNote'; payload: string };

// Webview → Extension
export type WebviewMessage =
  | { type: 'webviewDidLoad' }
  | { type: 'webviewDidSelectNode'; payload: string }
  | {
      type: 'webviewDidChangeViewState';
      payload: { viewName?: string; state: GraphViewState };
    }
  // the user reset the view: forget its saved state, so it follows its
  // configuration again
  | { type: 'webviewDidResetViewState'; payload: { viewName?: string } }
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
