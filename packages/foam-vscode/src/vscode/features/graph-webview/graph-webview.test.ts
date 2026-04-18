import * as vscode from 'vscode';
import { URI } from '../../../core/model/uri';
import { FoamWorkspace } from '../../../core/model/workspace';
import {
  getGraphStyle,
  getNodeNavigationCommand,
  handleActiveEditorChange,
  mergeStyles,
  viewConfigToStyle,
  resolveViewStyle,
} from '.';

describe('handleActiveEditorChange', () => {
  const makePanel = () =>
    ({
      webview: { postMessage: vi.fn() },
    } as unknown as vscode.WebviewPanel);

  const makeWorkspace = () => new FoamWorkspace([URI.file('/')]);

  it('does not throw when panel is undefined', () => {
    const foam = { workspace: makeWorkspace() } as any;
    const editor = {
      document: { uri: vscode.Uri.file('/some/note.md') },
    } as vscode.TextEditor;
    expect(() =>
      handleActiveEditorChange(undefined, foam, editor)
    ).not.toThrow();
  });

  it('does not throw when editor is undefined', () => {
    const panel = makePanel();
    const foam = { workspace: makeWorkspace() } as any;
    expect(() =>
      handleActiveEditorChange(panel, foam, undefined)
    ).not.toThrow();
    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('does not post message for untitled documents', () => {
    const panel = makePanel();
    const foam = { workspace: makeWorkspace() } as any;
    const editor = {
      document: { uri: vscode.Uri.parse('untitled:untitled-1') },
    } as vscode.TextEditor;
    expect(() => handleActiveEditorChange(panel, foam, editor)).not.toThrow();
    expect(panel.webview.postMessage).not.toHaveBeenCalled();
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
    const merged = mergeStyles({ colorMode: 'none' }, { colorMode: 'directory' });
    expect(merged.colorMode).toBe('directory');
  });

  it('base colorMode is kept when patch does not specify one', () => {
    const merged = mergeStyles({ colorMode: 'type' }, { style: { background: '#ff0000' } });
    expect(merged.colorMode).toBe('type');
  });

  it('patch overrides groups', () => {
    const group = { id: 'g1', label: 'G1', color: '#ff0000', enabled: true, match: { property: 'type', value: 'note' } };
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
    const style = viewConfigToStyle({ show: { tag: { enabled: false }, placeholder: { enabled: true } } });
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
    const group = { id: 'g1', label: 'G1', color: '#ff0000', enabled: true, match: { property: 'type', value: 'note' } };
    const style = viewConfigToStyle({ groups: [group] });
    expect(style.groups).toEqual([group]);
  });

  it('maps visual overrides to style', () => {
    const style = viewConfigToStyle({ background: '#123456', fontSize: 14, fontFamily: 'Mono', lineColor: '#aabbcc' });
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
    mockViews([{ name: 'Journal', colorBy: 'directory', background: '#111111' }]);
    const { style } = resolveViewStyle({ view: 'Journal', config: { colorBy: 'type' } });
    expect(style.colorMode).toBe('type');
    expect(style.style?.background).toBe('#111111');
  });

  it('inline config without view name skips Default view lookup', () => {
    mockViews([{ name: 'Default', colorBy: 'directory' }]);
    const { style } = resolveViewStyle({ config: { colorBy: 'type' } });
    // Default is skipped because config was explicitly provided
    expect(style.colorMode).toBe('type');
  });

  it('named view show.enabled is applied to showNodesOfType', () => {
    mockViews([{ name: 'Clean', show: { tag: { enabled: false }, placeholder: { enabled: false } } }]);
    const { style } = resolveViewStyle({ view: 'Clean' });
    expect(style.showNodesOfType?.tag).toBe(false);
    expect(style.showNodesOfType?.placeholder).toBe(false);
  });
});
