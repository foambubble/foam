declare module "foam-workspace-manager" {
  interface Note {
    /**
     * Base name of the file without extension, e.g. wiki-link
     */
    id: string;
    title: string;
    filename: string;
    extension: string;
    absolutePath: string;
    markdown: string; // do we need this?
  }

  interface NoteWithLinks extends Note {
    /**
     * Notes referenced from this note (wikilinks)
     */
    linkedNotes: Note[];

    /**
     * Notes that reference this note (backlinks) */
    backlinks: Note[];
  }

  // @todo figure out how to consume ts sources, as
  // foam-workspace-manager is written in typescript
  //
  // this isn't the full api
  export class WorkspaceManager {
    constructor(rootPath: string);
    addNoteFromMarkdown(filePath: string, markdown: string): Note;
    getNoteWithLinks(id: string): NoteWithLinks;
  }
}
