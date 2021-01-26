import * as path from 'path';
import { URI } from '../common/uri';
import { Note, NoteLink } from '../model/note';
import {
  computeRelativeURI,
  isSome,
  isNone,
  parseUri,
  placeholderUri,
} from '../utils';
// import { Event, Emitter } from '../common/event';

export function getReferenceType(
  reference: URI | string
): 'uri' | 'absolute-path' | 'relative-path' | 'key' {
  if (URI.isUri(reference)) {
    return 'uri';
  }
  const isPath = reference.split('/').length > 1;
  if (!isPath) {
    return 'key';
  }
  const isAbsPath = isPath && reference.startsWith('/');
  return isAbsPath ? 'absolute-path' : 'relative-path';
}

function normalizePath(pathValue: string) {
  const { ext } = path.parse(pathValue);
  return ext.length > 0 ? pathValue : pathValue + '.md';
}

function normalizeKey(pathValue: string) {
  const { ext, base } = path.parse(pathValue);
  return ext.length > 0 ? base : base + '.md';
}

export type Connection = {
  source: URI;
  target: URI;
};

export class FoamWorkspace {
  private notesByName: { [key: string]: string[] }; // note basename => note uri
  private notes: { [key: string]: Note };
  private attachments: Set<string>;

  private links: { [key: string]: Connection[] }; // source uri => target uri
  private backlinks: { [key: string]: Connection[] }; // target uri => source uri

  constructor() {
    this.notes = {};
    this.notesByName = {};
    this.attachments = new Set();
    this.links = {};
    this.backlinks = {};
  }

  resolveLink = FoamWorkspace.resolveLink.bind(null, this);
  resolveLinks = FoamWorkspace.resolveLinks.bind(null, this);
  getLinks = FoamWorkspace.getLinks.bind(null, this);
  getBacklinks = FoamWorkspace.getBacklinks.bind(null, this);
  getConnections = FoamWorkspace.getConnections.bind(null, this);
  addAttachment = FoamWorkspace.addAttachment.bind(null, this);
  setNote = FoamWorkspace.setNote.bind(null, this);
  noteExists = FoamWorkspace.noteExists.bind(null, this);
  getNotes = FoamWorkspace.getNotes.bind(null, this);
  getNote = FoamWorkspace.getNote.bind(null, this);
  findNote = FoamWorkspace.findNote.bind(null, this);
  deleteNote = FoamWorkspace.deleteNote.bind(null, this);

  public static resolveLink(
    workspace: FoamWorkspace,
    note: Note,
    link: NoteLink
  ) {
    let targetUri: URI | null = null;
    switch (link.type) {
      case 'wikilink':
        const definitionUri = note.definitions.find(
          def => def.label === link.slug
        )?.url;
        if (isSome(definitionUri)) {
          targetUri = computeRelativeURI(note.uri, definitionUri);
        } else {
          targetUri =
            FoamWorkspace.findNote(workspace, link.slug, note.uri)?.uri ?? null;
        }
        break;

      case 'link':
        targetUri = parseUri(note.uri, link.target);
        break;
    }
    return targetUri;
  }

  public static resolveLinks(workspace: FoamWorkspace): FoamWorkspace {
    workspace.links = {};
    workspace.backlinks = {};
    Object.values(workspace.notes).forEach(note => {
      note.links.forEach(link => {
        const targetUri =
          FoamWorkspace.resolveLink(workspace, note, link) ??
          placeholderUri(link.target);

        const source = note.uri.path;
        const target = targetUri.path;

        const connection = {
          source: note.uri,
          target: targetUri,
        };

        workspace.links[source] = workspace.links[source] ?? [];
        workspace.links[source].push(connection);
        workspace.backlinks[target] = workspace.backlinks[target] ?? [];
        workspace.backlinks[target].push(connection);
      });
    });
    return workspace;
  }

  public static getConnections(
    workspace: FoamWorkspace,
    uri: URI
  ): Connection[] {
    return [...workspace.links[uri.path], ...workspace.backlinks[uri.path]];
  }

  public static getLinks(workspace: FoamWorkspace, uri: URI): URI[] {
    return workspace.links[uri.path]?.map(c => c.target) ?? [];
  }

  public static getBacklinks(workspace: FoamWorkspace, uri: URI): URI[] {
    return workspace.backlinks[uri.path]?.map(c => c.source) ?? [];
  }

  public static addAttachment(
    workspace: FoamWorkspace,
    uri: URI
  ): FoamWorkspace {
    workspace.attachments.add(uri.path);
    return workspace;
  }

  public static setNote(workspace: FoamWorkspace, note: Note): FoamWorkspace {
    workspace.notes[note.uri.path] = note;
    const name = normalizeKey(note.uri.path);
    workspace.notesByName[name] = workspace.notesByName[name] ?? [];
    workspace.notesByName[name].push(note.uri.path);
    return workspace;
  }

  public static noteExists(workspace: FoamWorkspace, uri: URI): boolean {
    return isSome(workspace.notes[uri.path]);
  }

  public static getNotes(workspace: FoamWorkspace): Note[] {
    return Object.values(workspace.notes);
  }

  public static getNote(workspace: FoamWorkspace, uri: URI): Note {
    const note = FoamWorkspace.findNote(workspace, uri);
    if (isSome(note)) {
      return note;
    } else {
      throw new Error('Note not found: ' + uri.path);
    }
  }

  public static findNote(
    workspace: FoamWorkspace,
    noteId: URI | string,
    reference?: URI
  ): Note | null {
    const refType = getReferenceType(noteId);
    switch (refType) {
      case 'uri':
        const uri = noteId as URI;
        return FoamWorkspace.noteExists(workspace, uri)
          ? workspace.notes[uri.path]
          : null;

      case 'key':
        const key = normalizeKey(noteId as string);
        const notePath = workspace.notesByName[key]?.[0] ?? null;
        return workspace.notes[notePath];

      case 'absolute-path':
        const path = normalizePath(noteId as string);
        return workspace.notes[path];

      case 'relative-path':
        if (isNone(reference)) {
          throw new Error(
            'Cannot find note defined by relative path without reference note: ' +
              noteId
          );
        }
        const relativePath = noteId as string;
        const targetUri = computeRelativeURI(reference, relativePath);
        return workspace.notes[targetUri.path];

      default:
        throw new Error('Unexpected reference type: ' + refType);
    }
  }

  public static deleteNote(workspace: FoamWorkspace, uri: URI): Note | null {
    const deleted = workspace.notes[uri.path];
    delete workspace.notes[uri.path];
    return deleted ?? null;
  }
}
