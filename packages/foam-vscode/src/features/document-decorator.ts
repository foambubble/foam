import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { ResourceParser } from '../core/model/note';
import { FoamWorkspace } from '../core/model/workspace';
import { Foam } from '../core/model/foam';
import { Range } from '../core/model/range';
import { fromVsCodeUri } from '../utils/vsc-utils';

const placeholderDecoration = vscode.window.createTextEditorDecorationType({
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  textDecoration: 'none',
  color: { id: 'foam.placeholder' },
  cursor: 'pointer',
});

const updateDecorations = (
  parser: ResourceParser,
  workspace: FoamWorkspace
) => (editor: vscode.TextEditor) => {
  if (!editor || editor.document.languageId !== 'markdown') {
    return;
  }
  const note = parser.parse(
    fromVsCodeUri(editor.document.uri),
    editor.document.getText()
  );
  const placeholderRanges = [];
  note.links.forEach(link => {
    const linkUri = workspace.resolveLink(note, link);
    if (linkUri.isPlaceholder()) {
      placeholderRanges.push(
        Range.create(
          link.range.start.line,
          link.range.start.character + (link.type === 'wikilink' ? 2 : 0),
          link.range.end.line,
          link.range.end.character - (link.type === 'wikilink' ? 2 : 0)
        )
      );
    }
  });
  editor.setDecorations(placeholderDecoration, placeholderRanges);
};

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    let activeEditor = vscode.window.activeTextEditor;

    const immediatelyUpdateDecorations = updateDecorations(
      foam.services.parser,
      foam.workspace
    );

    const debouncedUpdateDecorations = debounce(
      immediatelyUpdateDecorations,
      500
    );

    immediatelyUpdateDecorations(activeEditor);

    context.subscriptions.push(
      placeholderDecoration,
      vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        immediatelyUpdateDecorations(activeEditor);
      }),
      vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
          debouncedUpdateDecorations(activeEditor);
        }
      })
    );
  },
};

export default feature;
