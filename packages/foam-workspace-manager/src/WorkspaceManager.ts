// for readability
import { basename } from 'path';
import {
  readWorkspaceFile,
  parseNoteTitleFromMarkdown,
  parseNoteLinksFromMarkdown,
} from './utils/utils';

type ID = string;

export interface ILooseFilename {
  /**
   * Base name of the file without extension, e.g. `Zoë File`
   */
  original: ID,
  /**
   * Cleaned version of the file, removing accents, casing, slugs, e.g. `zoe-file`
   */
  clean: string
}
export interface Note extends LooseFilename {
  title: string;
  filename: string;
  extension: string;
  absolutePath: string;
  markdown: string; // do we need this?
}

export interface NoteWithLinks extends Note {
  /**
   * Notes referenced from this note (wikilinks)
   */
  linkedNotes: LooseFilename[];

  /**
   * Notes that reference this note (backlinks) */
  backlinks: LooseFilename[];
}
export class LooseFilename implements ILooseFilename {
  original: ID;
  clean: string;
  constructor(original: string) {
    this.original = original;
    this.clean = LooseFilename.cleanPath(original)
  }
  public static cleanPath (path: string): string {
    const slug = '-'; //perhaps a config would be a better choice;
    return path
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") //Remove accents
      .replace(/[!"\#$%&'()*+,\-./:;<=>?@\[\\\]^_‘{|}~\s]+/gi, slug) //Normalise slugs
      .toLowerCase() // lower
      .replace(/[-_－＿ ]*$/g, ''); // removing trailing slug chars
  }
}

export class WorkspaceManager {
  /**
   * Workspace base path
   */
  path: string;
  /**
   * Note metadata for files in this workspace
   */
  notes: Array<NoteWithLinks> = new Array();

  constructor(path: string, notes: NoteWithLinks[] = []) {
    this.path = path;
    this.notes = notes;
  }
  public findBestMatchIndex(file: LooseFilename): number {
    let index = this.notes.findIndex(v => v.original === file.original);
    if (index === -1) {
      index = this.notes.findIndex(v => v.clean === file.clean)
    }
    return index;
  }
  public findBestMatch (file: LooseFilename): NoteWithLinks | null {
    return this.notes[this.findBestMatchIndex(file)];
  }
  public getNoteWithLinks(id: ID): NoteWithLinks | null {
    const file = new LooseFilename(id);

    this.associateAllForwardLinks();
    this.associateAllBacklinks();

    return this.findBestMatch(file)!;
    
  }

  /**
   *
   * @param filename File name relative to workspace path
   */
  public async addNoteByFilePath(filePath: string): Promise<Note> {
    return await this.addNoteFromMarkdown(
      this.path,
      await readWorkspaceFile(filePath)
    );
  }

  
  
  public addNoteFromMarkdown(absolutePath: string, markdown: string): Note {
    // parse markdown
    const filename = basename(absolutePath);

    const parts = filename.split('.');
    const extension = parts.pop()!;
    const file = new LooseFilename(parts.join('.'))
    
    const title = parseNoteTitleFromMarkdown(markdown);
    const note: NoteWithLinks = {
      ...file,
      title: title || file.original,
      filename,
      absolutePath,
      extension,
      markdown,
      linkedNotes: [],
      backlinks: [],
    };

    this.addOrUpdateNote(note);
    // extract linksTo
    return note;
  }

  public associateAllForwardLinks() {
    this.notes = this.notes.map(note => {
      note.linkedNotes = this.associateForwardlinks(note)
      return note;
    });
  }
  public associateForwardlinks(note: Note) : LooseFilename[] {
    return parseNoteLinksFromMarkdown(note.markdown)
      .map(v => new LooseFilename(v))
      .map(v => this.findBestMatch(v))
      .filter(v => !!v)
      .map(v => {
        return {
          original: v!.original,
          clean: v!.clean
        }
      });
  }
  
  public associateAllBacklinks() {
    this.notes = this.notes.map(note => {
      note.backlinks = this.getBacklinksToThisFile(note)
      return note;
    });
  }
  public getBacklinksToThisFile(file: LooseFilename) : LooseFilename[] {
    let arr:LooseFilename[] = [];
    this.notes.forEach(note => {
      if(note.linkedNotes.some(v => file.clean == v.clean)) {
        arr.push(note)
      }
    })
    return arr;
  }
  
  public addOrUpdateNote(note: NoteWithLinks) {
    let index = this.notes.findIndex(v=> v.original === note.original);
    if(index !== -1) {
      this.notes[index] = note;
    } else {
      this.notes.push(note);
    }
  }

  
  public removeNote(note: ID) {
    if (!note) {
      return null;
    }
    this.notes = this.notes.filter(v => v.original !== note);
    return true;
  }
  

  // @ts-expect-error
  public renameNote(note: Note, newFilename: string) {
    throw new Error('Not implemented');
  }
}
