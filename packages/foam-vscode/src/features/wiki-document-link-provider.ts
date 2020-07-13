import {
  DocumentLink,
  DocumentLinkProvider,
  ExtensionContext,
  languages,
  Range,
  TextDocument,
  Uri,
} from 'vscode';
import { Foam, NoteGraph, createNoteFromMarkdown } from 'foam-core';

export const LINK_SELECTOR = {
  scheme: 'file',
  language: 'markdown',
};

export const LINK_PREFIX = '[[';
export const LINK_SUFFIX = ']]';

const positionToLinkRange = (p) => {
  return new Range(
    p.start.line - 1,
    p.start.column + LINK_PREFIX.length - 1,
    p.end.line - 1,
    p.end.column - LINK_SUFFIX.length
  );
};

class WikiDocumentLinkProvider implements DocumentLinkProvider {
  notes: NoteGraph;

  constructor(_notes: NoteGraph) {
    this.notes = _notes;
  }

  public provideDocumentLinks(
    document: TextDocument
  ): DocumentLink[] | undefined {
    
    const note = createNoteFromMarkdown(document.fileName, document.getText());
    
    // update note in the graph
    this.notes.setNote(note);

    return note.links.map((link, index) => {
      const p = link.position;

      const to = this.notes.getNote(link.to);
      if (to) {
        const uri = Uri.parse(to.path);
        const linkRange = positionToLinkRange(link.position);
        const docLink = new DocumentLink(linkRange, uri);
        docLink.tooltip = to.title;
        return docLink;
      }

    }).filter(Boolean);
  }
}

const feature = {
  activate: async function createWikiDocumentLinkProvider(
    _context: ExtensionContext,
    foamPromise: Promise<Foam>
  ) {
    languages.registerDocumentLinkProvider(
      LINK_SELECTOR,
      new WikiDocumentLinkProvider((await foamPromise).notes)
    );
  }
};

export default feature;