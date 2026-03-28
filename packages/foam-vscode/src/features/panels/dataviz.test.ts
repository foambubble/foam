import * as vscode from 'vscode';
import { URI } from '../../core/model/uri';
import { FoamWorkspace } from '../../core/model/workspace';
import { getNodeNavigationCommand, handleActiveEditorChange } from './dataviz';

describe('handleActiveEditorChange', () => {
  const makePanel = () =>
    ({
      webview: { postMessage: jest.fn() },
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
