import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { Foam, FoamWorkspace, NoteParser, uris } from 'foam-core';
import { FoamFeature } from '../types';
import { isNote, mdDocSelector } from '../utils';
import { OPEN_COMMAND } from './utility-commands';
import { toVsCodeRange } from '../utils/vsc-utils';

const linkDecoration = vscode.window.createTextEditorDecorationType({
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  textDecoration: 'none',
  color: { id: 'textLink.foreground' },
  cursor: 'pointer',
});

const placeholderDecoration = vscode.window.createTextEditorDecorationType({
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  textDecoration: 'none',
  color: { id: 'editorWarning.foreground' },
  cursor: 'pointer',
});

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    let activeEditor = vscode.window.activeTextEditor;

    function updateDecorations() {
      if (!activeEditor) {
        return;
      }
      const note = foam.services.parser.parse(
        activeEditor.document.uri,
        activeEditor.document.getText()
      );
      let linkRanges = [];
      let placeholderRanges = [];
      note.links.forEach(link => {
        const linkUri = foam.workspace.resolveLink(note, link);
        if (linkUri.scheme === 'placeholder') {
          placeholderRanges.push(link.range);
        } else {
          linkRanges.push(link.range);
        }
      });
      activeEditor.setDecorations(linkDecoration, linkRanges);
      activeEditor.setDecorations(placeholderDecoration, placeholderRanges);
    }

    const debouncedUpdateDecorations = debounce(updateDecorations, 500);

    debouncedUpdateDecorations();

    context.subscriptions.push(
      // Link Provider
      vscode.languages.registerDocumentLinkProvider(
        mdDocSelector,
        new LinkProvider(foam.workspace, foam.services.parser)
      ),
      // Decorations for links
      linkDecoration,
      placeholderDecoration,
      vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
          debouncedUpdateDecorations();
        }
      }),
      vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
          debouncedUpdateDecorations();
        }
      })
    );
  },
};

export class LinkProvider implements vscode.DocumentLinkProvider {
  constructor(private workspace: FoamWorkspace, private parser: NoteParser) {}

  public provideDocumentLinks(
    document: vscode.TextDocument
  ): vscode.DocumentLink[] {
    const resource = this.parser.parse(document.uri, document.getText());

    if (isNote(resource)) {
      return resource.links.map(link => {
        const target = this.workspace.resolveLink(resource, link);
        const command = OPEN_COMMAND.asURI(target);
        const documentLink = new vscode.DocumentLink(
          toVsCodeRange(link.range),
          command
        );
        documentLink.tooltip = uris.isPlaceholder(target)
          ? `Create note for '${target.path}'`
          : `Go to ${target.fsPath}`;
        return documentLink;
      });
    }
    return [];
  }
}

export default feature;
