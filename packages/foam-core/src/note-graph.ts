import { Graph } from 'graphlib';
import { EventEmitter } from 'events';
import { URI, ID, Note, NoteLink } from './types';
import { hashURI, computeRelativeURI } from './utils';

export type GraphNote = Note & {
  id: ID;
};

export interface GraphConnection {
  from: ID;
  to: ID;
  link: NoteLink;
}

export type NoteGraphEventHandler = (e: { note: GraphNote }) => void;

export type NotesQuery = { slug: string } | { title: string };

export interface NoteGraphAPI {
  setNote(note: Note): GraphNote;
  getNotes(query?: NotesQuery): GraphNote[];
  getNote(noteId: ID): GraphNote | null;
  getNoteByURI(uri: URI): GraphNote | null;
  getAllLinks(noteId: ID): GraphConnection[];
  getForwardLinks(noteId: ID): GraphConnection[];
  getBacklinks(noteId: ID): GraphConnection[];
  unstable_onNoteAdded(callback: NoteGraphEventHandler): void;
  unstable_onNoteUpdated(callback: NoteGraphEventHandler): void;
  unstable_removeEventListener(callback: NoteGraphEventHandler): void;
}

export type Middleware = (next: NoteGraphAPI) => Partial<NoteGraphAPI>;

export const createGraph = (middlewares: Middleware[]): NoteGraphAPI => {
  const graph: NoteGraphAPI = new NoteGraph();
  return middlewares.reduce((acc, m) => backfill(acc, m), graph);
};

export class NoteGraph implements NoteGraphAPI {
  private graph: Graph;
  private events: EventEmitter;
  private createIdFromURI: (uri: URI) => ID;

  constructor() {
    this.graph = new Graph();
    this.events = new EventEmitter();
    this.createIdFromURI = (uri) => uri;
  }

  public setNote(note: Note): GraphNote {
    const id = this.createIdFromURI(note.source.uri);
    const noteExists = this.graph.hasNode(id);
    if (noteExists) {
      (this.graph.outEdges(id) || []).forEach(edge => {
        this.graph.removeEdge(edge);
      });
    }
    const graphNote: GraphNote = {
      ...note,
      id: id,
    };
    this.graph.setNode(id, graphNote);
    note.links.forEach(link => {
      const relativePath =
        note.definitions.find(def => def.label === link.slug)?.url ?? link.slug;
      const targetPath = computeRelativeURI(note.source.uri, relativePath);
      const targetId = this.createIdFromURI(targetPath);
      const connection: GraphConnection = {
        from: graphNote.id,
        to: targetId,
        link: link,
      };
      this.graph.setEdge(graphNote.id, targetId, connection);
    });
    this.events.emit(noteExists ? 'update' : 'add', { note: graphNote });
    return graphNote;
  }

  public getNotes(query?: NotesQuery): GraphNote[] {
    // prettier-ignore
    const filterFn =
      query == null ? (note: Note | null) => note != null
        : 'slug' in query ? (note: Note | null) => note?.slug === query.slug
        : 'title' in query ? (note: Note | null) => note?.title === query.title
        : (note: Note | null) => note != null;

    return this.graph
      .nodes()
      .map(id => this.graph.node(id))
      .filter(filterFn);
  }

  public getNote(noteId: ID): GraphNote | null {
    return this.graph.node(noteId) ?? null;
  }

  public getNoteByURI(uri: URI): GraphNote | null {
    return this.getNote(this.createIdFromURI(uri));
  }

  public getAllLinks(noteId: ID): GraphConnection[] {
    return (this.graph.nodeEdges(noteId) || []).map(edge =>
      this.graph.edge(edge.v, edge.w)
    );
  }

  public getForwardLinks(noteId: ID): GraphConnection[] {
    return (this.graph.outEdges(noteId) || []).map(edge =>
      this.graph.edge(edge.v, edge.w)
    );
  }

  public getBacklinks(noteId: ID): GraphConnection[] {
    return (this.graph.inEdges(noteId) || []).map(edge =>
      this.graph.edge(edge.v, edge.w)
    );
  }

  public unstable_onNoteAdded(callback: NoteGraphEventHandler) {
    this.events.addListener('add', callback);
  }

  public unstable_onNoteUpdated(callback: NoteGraphEventHandler) {
    this.events.addListener('update', callback);
  }

  public unstable_removeEventListener(callback: NoteGraphEventHandler) {
    this.events.removeListener('add', callback);
    this.events.removeListener('update', callback);
  }

  public dispose() {
    this.events.removeAllListeners();
  }
}

const backfill = (next: NoteGraphAPI, middleware: Middleware): NoteGraphAPI => {
  const m = middleware(next);
  return {
    setNote: m.setNote || next.setNote,
    getNotes: m.getNotes || next.getNotes,
    getNote: m.getNote || next.getNote,
    getNoteByURI: m.getNoteByURI || next.getNoteByURI,
    getAllLinks: m.getAllLinks || next.getAllLinks,
    getForwardLinks: m.getForwardLinks || next.getForwardLinks,
    getBacklinks: m.getBacklinks || next.getBacklinks,
    unstable_onNoteAdded: next.unstable_onNoteAdded.bind(next),
    unstable_onNoteUpdated: next.unstable_onNoteUpdated.bind(next),
    unstable_removeEventListener: next.unstable_removeEventListener.bind(next),
  };
};
