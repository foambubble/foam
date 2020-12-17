import { Graph } from 'graphlib';
import { URI } from '../common/uri';
import { Note, NoteLink } from '../model/note';
import { computeRelativeURI, nameToSlug, isSome } from '../utils';
import { Event, Emitter } from '../common/event';

export interface GraphConnection {
  from: URI;
  to: URI;
  link: NoteLink;
}

export type NoteGraphEventHandler = (e: { note: Note }) => void;

export type NotesQuery = { slug: string } | { title: string };

export interface NoteGraphAPI {
  setNote(note: Note): Note;
  deleteNote(noteUri: URI): Note | null;
  getNotes(query?: NotesQuery): Note[];
  getNote(noteUri: URI): Note | null;
  getAllLinks(noteUri: URI): GraphConnection[];
  getForwardLinks(noteUri: URI): GraphConnection[];
  getBacklinks(noteUri: URI): GraphConnection[];
  onDidAddNote: Event<Note>;
  onDidUpdateNote: Event<Note>;
  onDidDeleteNote: Event<Note>;
}

export type Middleware = (next: NoteGraphAPI) => Partial<NoteGraphAPI>;

export const createGraph = (middlewares: Middleware[]): NoteGraphAPI => {
  const graph: NoteGraphAPI = new NoteGraph();
  return middlewares.reduce((acc, m) => backfill(acc, m), graph);
};

const uriToId = (uri: URI) => uri.path;

export class NoteGraph implements NoteGraphAPI {
  onDidAddNote: Event<Note>;
  onDidUpdateNote: Event<Note>;
  onDidDeleteNote: Event<Note>;

  private graph: Graph;
  private onDidAddNoteEmitter = new Emitter<Note>();
  private onDidUpdateNoteEmitter = new Emitter<Note>();
  private onDidDeleteEmitter = new Emitter<Note>();

  constructor() {
    this.graph = new Graph();
    this.onDidAddNote = this.onDidAddNoteEmitter.event;
    this.onDidUpdateNote = this.onDidUpdateNoteEmitter.event;
    this.onDidDeleteNote = this.onDidDeleteEmitter.event;
  }

  public setNote(note: Note): Note {
    const oldNote = this.getNote(note.uri);
    if (isSome(oldNote)) {
      this.removeForwardLinks(note.uri);
    }
    const graphNote: Note = {
      ...note,
    };
    this.graph.setNode(uriToId(note.uri), graphNote);
    note.links.forEach(link => {
      const relativePath =
        note.definitions.find(def => def.label === link.slug)?.url ?? link.slug;
      const targetUri = computeRelativeURI(note.uri, relativePath);
      const connection: GraphConnection = {
        from: graphNote.uri,
        to: targetUri,
        link: link,
      };
      this.graph.setEdge(
        uriToId(graphNote.uri),
        uriToId(targetUri),
        connection
      );
    });
    isSome(oldNote)
      ? this.onDidUpdateNoteEmitter.fire(graphNote)
      : this.onDidAddNoteEmitter.fire(graphNote);
    return graphNote;
  }

  public deleteNote(noteUri: URI): Note | null {
    return this.doDelete(noteUri, true);
  }

  private doDelete(noteUri: URI, fireEvent: boolean): Note | null {
    const note = this.getNote(noteUri);
    if (isSome(note)) {
      if (this.getBacklinks(noteUri).length >= 1) {
        this.graph.setNode(uriToId(noteUri), null); // Changes node to the "no file" style
      } else {
        this.graph.removeNode(uriToId(noteUri));
      }
      fireEvent && this.onDidDeleteEmitter.fire(note);
    }
    return note;
  }

  public getNotes(query?: NotesQuery): Note[] {
    // prettier-ignore
    const filterFn =
      query == null ? (note: Note | null) => note != null
        : 'slug' in query ? (note: Note | null) => [nameToSlug(query.slug), query.slug].includes(note?.slug as string)
        : 'title' in query ? (note: Note | null) => note?.title === query.title
        : (note: Note | null) => note != null;

    return this.graph
      .nodes()
      .map(id => this.graph.node(id))
      .filter(filterFn);
  }

  public getNote(noteUri: URI): Note | null {
    return this.graph.node(uriToId(noteUri)) ?? null;
  }

  public getAllLinks(noteUri: URI): GraphConnection[] {
    return (this.graph.nodeEdges(uriToId(noteUri)) || []).map(edge =>
      this.graph.edge(edge.v, edge.w)
    );
  }

  public getForwardLinks(noteUri: URI): GraphConnection[] {
    return (this.graph.outEdges(uriToId(noteUri)) || []).map(edge =>
      this.graph.edge(edge.v, edge.w)
    );
  }

  public removeForwardLinks(noteUri: URI) {
    (this.graph.outEdges(uriToId(noteUri)) || []).forEach(edge => {
      this.graph.removeEdge(edge);
    });
  }

  public getBacklinks(noteUri: URI): GraphConnection[] {
    return (this.graph.inEdges(uriToId(noteUri)) || []).map(edge =>
      this.graph.edge(edge.v, edge.w)
    );
  }

  public dispose() {
    this.onDidAddNoteEmitter.dispose();
    this.onDidUpdateNoteEmitter.dispose();
    this.onDidDeleteEmitter.dispose();
  }
}

const backfill = (next: NoteGraphAPI, middleware: Middleware): NoteGraphAPI => {
  const m = middleware(next);
  return {
    setNote: m.setNote || next.setNote,
    deleteNote: m.deleteNote || next.deleteNote,
    getNotes: m.getNotes || next.getNotes,
    getNote: m.getNote || next.getNote,
    getAllLinks: m.getAllLinks || next.getAllLinks,
    getForwardLinks: m.getForwardLinks || next.getForwardLinks,
    getBacklinks: m.getBacklinks || next.getBacklinks,
    onDidAddNote: next.onDidAddNote,
    onDidUpdateNote: next.onDidUpdateNote,
    onDidDeleteNote: next.onDidDeleteNote,
  };
};
