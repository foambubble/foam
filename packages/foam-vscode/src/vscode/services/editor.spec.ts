/* @unit-ready */
import { commands, Selection, Uri, window, workspace } from 'vscode';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import {
  closeEditors,
  createFile,
  getActiveTabViewType,
  MARKDOWN_EDITOR_VIEW_TYPE,
  showInEditor,
  withMarkdownEditorAssociation,
} from '../../test/test-utils-vscode';
import {
  asAbsoluteWorkspaceUri,
  deleteFile,
  formatMarkdownTooltip,
  getActiveTabUri,
  getCurrentEditorDirectory,
  pickTabUri,
  replaceSelection,
} from './editor';
import { URI } from '@foam/core';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';

describe('Editor utils', () => {
  beforeAll(closeEditors);
  beforeAll(closeEditors);

  describe('getCurrentEditorDirectory', () => {
    it('should return the directory of the active text editor', async () => {
      const file = await createFile('this is the file content.', [
        'editor-utils',
        'file.md',
      ]);
      await showInEditor(file.uri);

      expect(getCurrentEditorDirectory()).toEqual(file.uri.getDirectory());
    });

    it('should throw if no editor is open', async () => {
      await closeEditors();
      expect(() => getCurrentEditorDirectory()).toThrow();
    });
  });

  describe('replaceSelection', () => {
    it('should replace the selection in the active editor', async () => {
      const fileA = await createFile('This is the file A', [
        'replace-selection',
        'file.md',
      ]);
      const doc = await showInEditor(fileA.uri);
      const selection = new Selection(0, 5, 0, 7); // 'is'

      await replaceSelection(doc.doc, selection, 'was');

      expect(doc.doc.getText()).toEqual('This was the file A');
    });
  });

  describe('asAbsoluteWorkspaceUri', () => {
    it('should work with the VS Code workspace folders if none are passed', () => {
      const uri = URI.file('relative/path');
      const workspaceFolder = workspace.workspaceFolders[0];
      expect(asAbsoluteWorkspaceUri(uri)).toEqual(
        fromVsCodeUri(workspaceFolder.uri).joinPath(uri.path)
      );
    });
  });

  describe('getActiveTabUri', () => {
    it('resolves a note open in the editor associated with Markdown (#1742)', async () => {
      await closeEditors();
      const file = await createFile('# A note', [
        'active-tab',
        'associated.md',
      ]);

      await withMarkdownEditorAssociation(async () => {
        await commands.executeCommand('vscode.open', toVsCodeUri(file.uri));

        expect(getActiveTabViewType()).toEqual(MARKDOWN_EDITOR_VIEW_TYPE);
        // A custom editor has no TextEditor: only the tab knows the note.
        expect(window.activeTextEditor).toBeUndefined();
        expect(getActiveTabUri()).toEqual(file.uri);
      });

      await closeEditors();
      await deleteFile(file.uri);
    });

    it('resolves a note open in the text editor', async () => {
      await closeEditors();
      const file = await createFile('# A note', ['active-tab', 'plain.md']);

      await commands.executeCommand('vscode.open', toVsCodeUri(file.uri));

      expect(getActiveTabUri()).toEqual(file.uri);

      await closeEditors();
      await deleteFile(file.uri);
    });
  });
});

describe('formatMarkdownTooltip', () => {
  it('does not blanket-trust markdown tooltips built from note content', () => {
    const md = formatMarkdownTooltip('some note content');
    expect(md.isTrusted).not.toBe(true);
    expect((md.isTrusted as any).enabledCommands).toEqual(
      expect.arrayContaining([
        'foam-vscode.open-resource',
        'foam-vscode.create-note',
      ])
    );
  });

  it('does not enable dangerous built-in commands in tooltips', () => {
    const md = formatMarkdownTooltip('some note content');
    const enabled = (md.isTrusted as any).enabledCommands as string[];
    expect(enabled).not.toContain('workbench.action.terminal.sendSequence');
    expect(enabled).not.toContain('workbench.action.tasks.runTask');
  });
});

describe('pickTabUri', () => {
  const uri = Uri.file('/workspace/note.md');
  const expected = fromVsCodeUri(uri);

  it('returns the active text editor URI when there is no active tab', () => {
    expect(pickTabUri(undefined, { activeUri: uri })).toEqual(expected);
  });

  it('returns the URI from a text-editor tab input', () => {
    expect(
      pickTabUri({ input: { uri }, label: 'note.md' }, undefined)
    ).toEqual(expected);
  });

  it('returns the URI from a custom-editor tab input (e.g. "Reopen With" markdown-editor)', () => {
    expect(
      pickTabUri(
        { input: { uri, viewType: 'markdown-editor.customEditor' } },
        undefined
      )
    ).toEqual(expected);
  });

  it('returns the URI from a notebook tab input', () => {
    expect(
      pickTabUri({ input: { uri, notebookType: 'jupyter-notebook' } }, undefined)
    ).toEqual(expected);
  });

  it('prefers the tab input URI over the active text editor URI', () => {
    const otherUri = Uri.file('/workspace/other.md');
    expect(pickTabUri({ input: { uri } }, { activeUri: otherUri })).toEqual(
      expected
    );
  });

  it('returns undefined when nothing is active', () => {
    expect(pickTabUri(undefined, undefined)).toBeUndefined();
  });

  describe('webview tabs (no URI in tab input)', () => {
    // Webview panels (e.g. zaaack.markdown-editor's "Open with markdown
    // editor" command) expose no URI, only the panel title as tab label,
    // which by convention is the file's basename
    const ws = createTestWorkspace();
    const noteA = createTestNote({ uri: '/notes/note-a.md' });
    ws.set(noteA);

    it('resolves the tab label as a note identifier', () => {
      expect(
        pickTabUri(
          { input: { viewType: 'markdown-editor' }, label: 'note-a.md' },
          undefined,
          ws
        )
      ).toEqual(noteA.uri);
    });

    it('falls back to the active text editor when the label is not a note', () => {
      expect(
        pickTabUri(
          { input: { viewType: 'some-webview' }, label: 'Foam Graph' },
          { activeUri: uri },
          ws
        )
      ).toEqual(expected);
    });

    it('returns undefined when the label is not a note and nothing else is active', () => {
      expect(
        pickTabUri(
          { input: { viewType: 'some-webview' }, label: 'Foam Graph' },
          undefined,
          ws
        )
      ).toBeUndefined();
    });

    it('ignores the label when no workspace is provided', () => {
      expect(
        pickTabUri(
          { input: { viewType: 'markdown-editor' }, label: 'note-a.md' },
          undefined
        )
      ).toBeUndefined();
    });

    describe('markdown preview style labels (prefix + file name)', () => {
      it('resolves "Preview note-a.md"', () => {
        expect(
          pickTabUri(
            {
              input: { viewType: 'mainThreadWebview-markdown.preview' },
              label: 'Preview note-a.md',
            },
            undefined,
            ws
          )
        ).toEqual(noteA.uri);
      });

      it('resolves localized preview labels (e.g. "Vorschau note-a.md")', () => {
        expect(
          pickTabUri(
            {
              input: { viewType: 'mainThreadWebview-markdown.preview' },
              label: 'Vorschau note-a.md',
            },
            undefined,
            ws
          )
        ).toEqual(noteA.uri);
      });

      it('resolves locked preview labels (e.g. "[Preview] note-a.md")', () => {
        expect(
          pickTabUri(
            {
              input: { viewType: 'mainThreadWebview-markdown.preview' },
              label: '[Preview] note-a.md',
            },
            undefined,
            ws
          )
        ).toEqual(noteA.uri);
      });

      it('prefers the longest file name match for names containing spaces', () => {
        const wsWithSpaces = createTestWorkspace();
        const myNote = createTestNote({ uri: '/notes/my note.md' });
        const note = createTestNote({ uri: '/notes/note.md' });
        wsWithSpaces.set(myNote).set(note);
        expect(
          pickTabUri(
            {
              input: { viewType: 'mainThreadWebview-markdown.preview' },
              label: 'Preview my note.md',
            },
            undefined,
            wsWithSpaces
          )
        ).toEqual(myNote.uri);
      });

      it('does not resolve label words that do not look like a file name', () => {
        const wsWithGraph = createTestWorkspace();
        const graphNote = createTestNote({ uri: '/notes/Graph.md' });
        wsWithGraph.set(graphNote);
        // "Foam Graph" must not retarget the panels to the note `Graph.md`
        expect(
          pickTabUri(
            { input: { viewType: 'foam-graph' }, label: 'Foam Graph' },
            undefined,
            wsWithGraph
          )
        ).toBeUndefined();
      });
    });

    describe('built-in Markdown Preview without a usable label', () => {
      // Robustness fallback: when the markdown preview is open side-by-side
      // (showPreviewToSide), the source markdown editor is still visible.
      // If the label heuristic fails (unknown label format, future
      // upstream change, no workspace match), fall back to the single
      // visible markdown editor.
      const previewTab = {
        input: { viewType: 'mainThreadWebview-markdown.preview' },
        label: 'unrecognized label',
      };

      it('falls back to the sole visible markdown editor', () => {
        expect(
          pickTabUri(previewTab, { visibleUris: [uri] })
        ).toEqual(expected);
      });

      it('prefers the visible markdown editor over the activeTextEditor URI', () => {
        // The preview tab being active means activeTextEditor is undefined,
        // but a non-markdown editor (e.g. a JSON settings file) may still
        // be on activeUri from a previous focus snapshot in some flows.
        const otherUri = Uri.file('/workspace/other.json');
        expect(
          pickTabUri(previewTab, {
            activeUri: otherUri,
            visibleUris: [uri],
          })
        ).toEqual(expected);
      });

      it('does not guess when multiple markdown editors are visible', () => {
        const otherUri = Uri.file('/workspace/other.md');
        // Ambiguous: which one does the preview render? Bail to the
        // activeTextEditor fallback rather than guess wrong.
        expect(
          pickTabUri(previewTab, { visibleUris: [uri, otherUri] })
        ).toBeUndefined();
      });

      it('ignores visible non-markdown editors', () => {
        const jsonUri = Uri.file('/workspace/data.json');
        expect(
          pickTabUri(previewTab, { visibleUris: [jsonUri] })
        ).toBeUndefined();
      });

      it('does not apply the visible-editor fallback to unrelated webview tabs', () => {
        const otherWebview = {
          input: { viewType: 'foam-graph' },
          label: 'Foam Graph',
        };
        expect(
          pickTabUri(otherWebview, { visibleUris: [uri] })
        ).toBeUndefined();
      });
    });
  });
});
