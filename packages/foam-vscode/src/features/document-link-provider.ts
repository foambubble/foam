import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { Foam, uris } from 'foam-core';
import { FoamFeature } from '../types';
import { isNote, mdDocSelector, astPositionToVsCodeRange } from '../utils';
import { OPEN_COMMAND } from './utility-commands';

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
      const note = foam.parse(
        activeEditor.document.uri,
        activeEditor.document.getText()
      );
      let linkRanges = [];
      let placeholderRanges = [];
      note.links.forEach(link => {
        const linkUri = foam.workspace.resolveLink(note, link);
        if (linkUri.scheme === 'placeholder') {
          placeholderRanges.push(astPositionToVsCodeRange(link.position));
        } else {
          linkRanges.push(astPositionToVsCodeRange(link.position));
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
        new LinkProvider(await foamPromise)
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
  constructor(private foam: Foam) {}

  public provideDocumentLinks(
    document: vscode.TextDocument
  ): vscode.DocumentLink[] {
    const resource = this.foam.parse(document.uri, document.getText());

    if (isNote(resource)) {
      return resource.links.map(link => {
        const target = this.foam.workspace.resolveLink(resource, link);

        const documentLink = new vscode.DocumentLink(
          astPositionToVsCodeRange(link.position),
          OPEN_COMMAND.asURI(target)
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
