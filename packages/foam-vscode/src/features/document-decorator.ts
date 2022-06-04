import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { Resource, Tag, ResourceParser } from '../core/model/note';
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

const tagDecoration = vscode.window.createTextEditorDecorationType({
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  textDecoration: 'none',
  color: { id: 'foam.tag' },
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

  editor.setDecorations(
    placeholderDecoration,
    getPlaceholderRanges(workspace, note)
  );

  editor.setDecorations(tagDecoration, getTagRanges(note.tags));
};

const getPlaceholderRanges = (
  workspace: FoamWorkspace,
  note: Resource
): vscode.Range[] =>
  note.links
    .filter(link => workspace.resolveLink(note, link).isPlaceholder())
    .map(link =>
      Range.create(
        link.range.start.line,
        link.range.start.character + (link.type === 'wikilink' ? 2 : 0),
        link.range.end.line,
        link.range.end.character - (link.type === 'wikilink' ? 2 : 0)
      )
    ) as vscode.Range[];

const getTagRanges = (tags: Tag[]): vscode.Range[] =>
  tags.map(tag =>
    Range.create(
      tag.range.start.line,
      tag.range.start.character,
      tag.range.end.line,
      tag.range.end.character
    )
  ) as vscode.Range[];

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
