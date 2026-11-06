import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { URI } from '@foam/core';
import { FoamGraph, FoamWorkspace } from '@foam/core';
import { createTestNote, createTestWorkspace } from '../../../test/test-utils';
import { MapBasedMemento } from '../../utils/vsc-utils';
import {
  createWebviewMessageHandler,
  getGraphStyle,
  getNodeNavigationCommand,
  handleActiveResourceChange,
  mergeStyles,
  retargetGraphPanel,
  updateGraph,
  viewConfigToStyle,
  viewNameFromPanelTitle,
  resolveViewStyle,
} from '.';
import { saveViewState, VIEW_STATE_KEY } from './view-state-store';

// several describes below stub vscode.workspace.getConfiguration; clean up
// so no test depends on execution order
afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleActiveResourceChange', () => {
  const makePanel = () =>
    ({
      webview: { postMessage: vi.fn() },
    } as unknown as vscode.WebviewPanel);

  const makeWorkspace = () => new FoamWorkspace([URI.file('/')]);

  it('does not throw when panel is undefined', () => {
    const foam = { workspace: makeWorkspace() } as any;
    expect(() =>
      handleActiveResourceChange(undefined, foam, URI.file('/some/note.md'))
    ).not.toThrow();
  });

  it('does not throw when uri is undefined', () => {
    const panel = makePanel();
    const foam = { workspace: makeWorkspace() } as any;
    expect(() =>
      handleActiveResourceChange(panel, foam, undefined)
    ).not.toThrow();
    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('does not post message for untitled documents', () => {
    const panel = makePanel();
    const foam = { workspace: makeWorkspace() } as any;
    const uri = new URI({ scheme: 'untitled', path: 'untitled-1' });
    expect(() => handleActiveResourceChange(panel, foam, uri)).not.toThrow();
    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('does not post message nor throw for files not in the workspace', () => {
    const panel = makePanel();
    const foam = { workspace: makeWorkspace() } as any;
    expect(() =>
      handleActiveResourceChange(panel, foam, URI.file('/not/a/note.json'))
    ).not.toThrow();
    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('posts a didSelectNote message for notes in the workspace', () => {
    const panel = makePanel();
    const ws = createTestWorkspace();
    const note = createTestNote({ uri: '/notes/note-a.md' });
    ws.set(note);
    const foam = { workspace: ws } as any;
    handleActiveResourceChange(panel, foam, note.uri);
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'didSelectNote',
      payload: note.uri.path,
    });
  });
});

describe('getNodeNavigationCommand', () => {
  describe('when navigateToPreview is false', () => {
    it('returns vscode.open for markdown files', () => {
      expect(getNodeNavigationCommand('/path/to/note.md', false)).toBe(
        'vscode.open'
      );
    });

    it('returns vscode.open for non-markdown files', () => {
      expect(getNodeNavigationCommand('/path/to/image.png', false)).toBe(
        'vscode.open'
      );
    });
  });

  describe('when navigateToPreview is true', () => {
    it('returns markdown.showPreview for markdown files', () => {
      expect(getNodeNavigationCommand('/path/to/note.md', true)).toBe(
        'markdown.showPreview'
      );
    });

    it('returns vscode.open for non-markdown files', () => {
      expect(getNodeNavigationCommand('/path/to/image.png', true)).toBe(
        'vscode.open'
      );
    });

    it('returns vscode.open for files with no extension', () => {
      expect(getNodeNavigationCommand('/path/to/Makefile', true)).toBe(
        'vscode.open'
      );
    });
  });
});

// Regression tests for https://github.com/foambubble/foam/issues/1620
//
// foam.graph.style settings were silently ignored because getGraphStyle()
// returned the raw StyleConfig directly instead of wrapping it in the
// StylePayload envelope { style: StyleConfig } that the webview expects.
// As a result, payload.style was always undefined and theme defaults were used.
describe('getGraphStyle', () => {
  it('wraps the style config in a StylePayload envelope', () => {
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: (_key: string) => ({ background: '#ff0000', fontSize: 14 }),
    } as any);

    const payload = getGraphStyle();

    expect(payload.style).toBeDefined();
    expect(payload.style?.background).toBe('#ff0000');
    expect(payload.style?.fontSize).toBe(14);
  });

  it('returns an empty style object when no config is set', () => {
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: (_key: string) => undefined,
    } as any);

    const payload = getGraphStyle();

    expect(payload.style).toEqual({});
  });
});

describe('mergeStyles', () => {
  it('patch overrides base style properties', () => {
    const merged = mergeStyles(
      { style: { background: '#111111', fontSize: 10 } },
      { style: { background: '#222222' } }
    );
    expect(merged.style?.background).toBe('#222222');
    expect(merged.style?.fontSize).toBe(10);
  });

  it('patch overrides colorMode', () => {
    const merged = mergeStyles(
      { colorMode: 'none' },
      { colorMode: 'directory' }
    );
    expect(merged.colorMode).toBe('directory');
  });

  it('base colorMode is kept when patch does not specify one', () => {
    const merged = mergeStyles(
      { colorMode: 'type' },
      { style: { background: '#ff0000' } }
    );
    expect(merged.colorMode).toBe('type');
  });

  it('patch overrides groups', () => {
    const group = {
      id: 'g1',
      label: 'G1',
      color: '#ff0000',
      enabled: true,
      match: { property: 'type', value: 'note' },
    };
    const merged = mergeStyles({ groups: [] }, { groups: [group] });
    expect(merged.groups).toEqual([group]);
  });

  it('showNodesOfType is merged (not replaced)', () => {
    const merged = mergeStyles(
      { showNodesOfType: { tag: true, placeholder: false } },
      { showNodesOfType: { placeholder: true } }
    );
    expect(merged.showNodesOfType).toEqual({ tag: true, placeholder: true });
  });
});

describe('viewConfigToStyle', () => {
  it('maps colorBy to colorMode', () => {
    const style = viewConfigToStyle({ colorBy: 'directory' });
    expect(style.colorMode).toBe('directory');
  });

  it('maps show.enabled to showNodesOfType', () => {
    const style = viewConfigToStyle({
      show: { tag: { enabled: false }, placeholder: { enabled: true } },
    });
    expect(style.showNodesOfType).toEqual({ tag: false, placeholder: true });
  });

  it('defaults show.enabled to true when not specified', () => {
    const style = viewConfigToStyle({ show: { tag: {} } });
    expect(style.showNodesOfType?.tag).toBe(true);
  });

  it('maps show.color to style.node', () => {
    const style = viewConfigToStyle({ show: { tag: { color: '#ff0000' } } });
    expect(style.style?.node?.tag).toBe('#ff0000');
  });

  it('omits style.node when no colors are set', () => {
    const style = viewConfigToStyle({ show: { tag: { enabled: false } } });
    expect(style.style?.node).toBeUndefined();
  });

  it('passes groups through', () => {
    const group = {
      id: 'g1',
      label: 'G1',
      color: '#ff0000',
      enabled: true,
      match: { property: 'type', value: 'note' },
    };
    const style = viewConfigToStyle({ groups: [group] });
    expect(style.groups).toEqual([group]);
  });

  it('maps visual overrides to style', () => {
    const style = viewConfigToStyle({
      background: '#123456',
      fontSize: 14,
      fontFamily: 'Mono',
      lineColor: '#aabbcc',
    });
    expect(style.style?.background).toBe('#123456');
    expect(style.style?.fontSize).toBe(14);
    expect(style.style?.fontFamily).toBe('Mono');
    expect(style.style?.lineColor).toBe('#aabbcc');
  });
});

describe('resolveViewStyle', () => {
  const mockViews = (views: unknown[]) => {
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: (key: string) => {
        if (key === 'style') return {};
        if (key === 'views') return views;
        return undefined;
      },
    } as any);
  };

  it('returns base graph style when no args given and no Default view exists', () => {
    mockViews([]);
    const { style, view } = resolveViewStyle();
    expect(style.style).toEqual({});
    expect(view).toBeUndefined();
  });

  it('applies Default named view when no args given', () => {
    mockViews([{ name: 'Default', colorBy: 'directory' }]);
    const { style } = resolveViewStyle();
    expect(style.colorMode).toBe('directory');
  });

  it('applies named view by view arg', () => {
    mockViews([{ name: 'Journal', colorBy: 'type' }]);
    const { style, view } = resolveViewStyle({ view: 'Journal' });
    expect(style.colorMode).toBe('type');
    expect(view).toBe('Journal');
  });

  it('unknown view name falls back to base style', () => {
    mockViews([]);
    const { style } = resolveViewStyle({ view: 'NonExistent' });
    expect(style.style).toEqual({});
    expect(style.colorMode).toBeUndefined();
  });

  it('inline config is applied on top of named view', () => {
    mockViews([
      { name: 'Journal', colorBy: 'directory', background: '#111111' },
    ]);
    const { style } = resolveViewStyle({
      view: 'Journal',
      config: { colorBy: 'type' },
    });
    expect(style.colorMode).toBe('type');
    expect(style.style?.background).toBe('#111111');
  });

  it('inline config without view name skips Default view lookup', () => {
    mockViews([{ name: 'Default', colorBy: 'directory' }]);
    const { style } = resolveViewStyle({ config: { colorBy: 'type' } });
    // Default is skipped because config was explicitly provided
    expect(style.colorMode).toBe('type');
  });

  it('treats an empty view name as no view name, falling back to Default', () => {
    mockViews([{ name: 'Default', colorBy: 'directory' }]);
    const { style, view } = resolveViewStyle({ view: '' });
    expect(style.colorMode).toBe('directory');
    expect(view).toBeUndefined();
  });

  it('named view show.enabled is applied to showNodesOfType', () => {
    mockViews([
      {
        name: 'Clean',
        show: { tag: { enabled: false }, placeholder: { enabled: false } },
      },
    ]);
    const { style } = resolveViewStyle({ view: 'Clean' });
    expect(style.showNodesOfType?.tag).toBe(false);
    expect(style.showNodesOfType?.placeholder).toBe(false);
  });
});

// AC-1: the setting is gone and has no effect
describe('foam.graph.titleMaxLength removal (#1205)', () => {
  it('is no longer a contributed setting', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../../../package.json'), 'utf-8')
    );
    expect(
      pkg.contributes.configuration.properties['foam.graph.titleMaxLength']
    ).toBeUndefined();
  });

  // AC-2: titles cross the extension → webview boundary untruncated,
  // for notes and placeholders alike, whatever settings.json says
  it('sends untruncated titles for every node type', async () => {
    await vscode.workspace
      .getConfiguration()
      .update('foam.graph.titleMaxLength', 4);
    try {
      const longTitle = 'A note title well over twenty-four characters long';
      const longTarget = 'a-placeholder-target-well-over-24-characters-long';
      const workspace = createTestWorkspace();
      const note = createTestNote({
        uri: '/notes/note-a.md',
        title: longTitle,
        links: [{ slug: longTarget }],
      });
      workspace.set(note);
      const graph = FoamGraph.fromWorkspace(workspace);
      const foam = { workspace, graph } as any;
      const panel = {
        webview: { postMessage: vi.fn() },
      } as unknown as vscode.WebviewPanel;

      updateGraph(panel, foam);

      const message = (panel.webview.postMessage as any).mock.calls[0][0];
      expect(message.type).toBe('didUpdateGraphData');
      expect(message.payload.nodeInfo[note.uri.path].title).toBe(longTitle);
      const placeholder = Object.values<any>(message.payload.nodeInfo).find(
        node => node.type === 'placeholder'
      );
      expect(placeholder).toBeDefined();
      expect(placeholder.title).toContain(longTarget);
      expect(placeholder.title).not.toContain('...');
    } finally {
      await vscode.workspace
        .getConfiguration()
        .update('foam.graph.titleMaxLength', undefined);
    }
  });
});

describe('viewNameFromPanelTitle', () => {
  it('extracts the view name from a named panel title', () => {
    expect(viewNameFromPanelTitle('Foam Graph: Journal')).toBe('Journal');
  });

  it('maps the nameless panel title to the Default bucket', () => {
    expect(viewNameFromPanelTitle('Foam Graph')).toBe('Default');
  });
});

describe('graph view state persistence', () => {
  const makeFoam = () => {
    const workspace = createTestWorkspace();
    return { workspace, graph: FoamGraph.fromWorkspace(workspace) } as any;
  };
  const makeStatePanel = (title: string) =>
    ({
      title,
      webview: { postMessage: vi.fn() },
    } as unknown as vscode.WebviewPanel);

  // AC-5: a changed preference is restored for the same view; another view
  // gets its own (empty) state, not this one's
  it('restores saved state for the view it was saved under', async () => {
    const memento = new MapBasedMemento();
    const journal = makeStatePanel('Foam Graph: Journal');
    await createWebviewMessageHandler(
      journal,
      makeFoam(),
      memento,
      undefined
    )({
      type: 'webviewDidChangeViewState',
      payload: { viewName: 'Journal', state: { labelMaxLength: 10 } },
    });

    const reopened = makeStatePanel('Foam Graph: Journal');
    await createWebviewMessageHandler(
      reopened,
      makeFoam(),
      memento,
      undefined
    )({ type: 'webviewDidLoad' });
    expect(reopened.webview.postMessage).toHaveBeenCalledWith({
      type: 'didRestoreViewState',
      payload: { viewName: 'Journal', state: { labelMaxLength: 10 } },
    });

    const other = makeStatePanel('Foam Graph: Other');
    await createWebviewMessageHandler(
      other,
      makeFoam(),
      memento,
      undefined
    )({
      type: 'webviewDidLoad',
    });
    expect(other.webview.postMessage).toHaveBeenCalledWith({
      type: 'didRestoreViewState',
      payload: { viewName: 'Other', state: {} },
    });
  });

  it('saves under the view name echoed by the webview, not the panel title', async () => {
    const memento = new MapBasedMemento();
    // the panel was already switched to Default while this save, made in
    // Journal, was still debounced in the webview
    const panel = makeStatePanel('Foam Graph');
    await createWebviewMessageHandler(
      panel,
      makeFoam(),
      memento,
      undefined
    )({
      type: 'webviewDidChangeViewState',
      payload: { viewName: 'Journal', state: { labelMaxLength: 10 } },
    });

    const all = memento.get<any>(VIEW_STATE_KEY);
    expect(all.Journal.labelMaxLength).toBe(10);
    expect(all.Default).toBeUndefined();
  });

  it('restores state after the style and before the graph data', async () => {
    const memento = new MapBasedMemento();
    await saveViewState(memento, 'Default', { labelMaxLength: 10 });

    const panel = makeStatePanel('Foam Graph');
    await createWebviewMessageHandler(
      panel,
      makeFoam(),
      memento,
      undefined
    )({
      type: 'webviewDidLoad',
    });

    const types = (panel.webview.postMessage as any).mock.calls.map(
      (call: any[]) => call[0].type
    );
    expect(types).toEqual([
      'didUpdateStyle',
      'didRestoreViewState',
      'didUpdateGraphData',
    ]);
  });

  // AC-7: unknown buckets and unknown fields survive a save
  it('preserves unknown buckets and fields through a save', async () => {
    const memento = new MapBasedMemento();
    await memento.update(VIEW_STATE_KEY, {
      Future: { someNewThing: true },
      Default: { labelMaxLength: 12, unknownField: 'kept' },
    });

    await saveViewState(memento, 'Default', { labelMaxLength: 5 });

    const all = memento.get<any>(VIEW_STATE_KEY);
    expect(all.Future).toEqual({ someNewThing: true });
    expect(all.Default.unknownField).toBe('kept');
    expect(all.Default.labelMaxLength).toBe(5);
  });

  it('merges type filters key-wise on save instead of overwriting them', async () => {
    const memento = new MapBasedMemento();
    await saveViewState(memento, 'Default', {
      showNodesOfType: { 'daily-note': false },
    });

    // a later snapshot taken while no daily note exists lacks the key
    await saveViewState(memento, 'Default', {
      showNodesOfType: { note: true },
      labelMaxLength: 10,
    });

    const all = memento.get<any>(VIEW_STATE_KEY);
    expect(all.Default.showNodesOfType['daily-note']).toBe(false);
    expect(all.Default.showNodesOfType.note).toBe(true);
  });
});

describe('retargetGraphPanel', () => {
  const makeStatePanel = (title: string) =>
    ({
      title,
      webview: { postMessage: vi.fn() },
    } as unknown as vscode.WebviewPanel);

  it('restores the target view state when the view changes', async () => {
    const memento = new MapBasedMemento();
    await saveViewState(memento, 'Journal', { labelMaxLength: 10 });
    const panel = makeStatePanel('Foam Graph');

    retargetGraphPanel(panel, memento, {}, 'Journal');

    expect(panel.title).toBe('Foam Graph: Journal');
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'didRestoreViewState',
      payload: { viewName: 'Journal', state: { labelMaxLength: 10 } },
    });
  });

  it('sends an empty state when the target view has none saved', () => {
    const memento = new MapBasedMemento();
    const panel = makeStatePanel('Foam Graph: Journal');

    retargetGraphPanel(panel, memento, {}, undefined);

    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'didRestoreViewState',
      payload: { viewName: 'Default', state: {} },
    });
  });

  it('does not restore when re-invoked for the already-open view', () => {
    const memento = new MapBasedMemento();
    const panel = makeStatePanel('Foam Graph: Journal');

    retargetGraphPanel(panel, memento, {}, 'Journal');

    const types = (panel.webview.postMessage as any).mock.calls.map(
      (call: any[]) => call[0].type
    );
    expect(types).toEqual(['didUpdateStyle']);
  });
});
