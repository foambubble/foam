import { Uri } from 'vscode';
import { fromVsCodeUri } from '../utils/vsc-utils';
import { pickTabUri } from './editor';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';

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
