import { Graph } from 'graphlib';
import { URI, ID, Note, NoteLink } from './types';
import { computeRelativeURI, nameToSlug } from './utils';
import { Event, Emitter } from './common/event';

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
  onDidAddNote: Event<GraphNote>;
  onDidUpdateNote: Event<GraphNote>;
  onDidRemoveNote: Event<GraphNote>;
}

export type Middleware = (next: NoteGraphAPI) => Partial<NoteGraphAPI>;

export const createGraph = (middlewares: Middleware[]): NoteGraphAPI => {
  const graph: NoteGraphAPI = new NoteGraph();
  return middlewares.reduce((acc, m) => backfill(acc, m), graph);
};

export class NoteGraph implements NoteGraphAPI {
  onDidAddNote: Event<GraphNote>;
  onDidUpdateNote: Event<GraphNote>;
  onDidRemoveNote: Event<GraphNote>;

  private graph: Graph;
  private createIdFromURI: (uri: URI) => ID;
  private onDidAddNoteEmitter = new Emitter<GraphNote>();
  private onDidUpdateNoteEmitter = new Emitter<GraphNote>();
  private onDidRemoveNoteEmitter = new Emitter<GraphNote>();

  constructor() {
    this.graph = new Graph();
    this.onDidAddNote = this.onDidAddNoteEmitter.event;
    this.onDidUpdateNote = this.onDidUpdateNoteEmitter.event;
    this.onDidRemoveNote = this.onDidRemoveNoteEmitter.event;
    this.createIdFromURI = uri => uri;
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
    noteExists
      ? this.onDidUpdateNoteEmitter.fire(graphNote)
      : this.onDidAddNoteEmitter.fire(graphNote);
    return graphNote;
  }

  public getNotes(query?: NotesQuery): GraphNote[] {
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

  public dispose() {
    this.onDidAddNoteEmitter.dispose();
    this.onDidUpdateNoteEmitter.dispose();
    this.onDidRemoveNoteEmitter.dispose();
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
    onDidAddNote: next.onDidAddNote,
    onDidUpdateNote: next.onDidUpdateNote,
    onDidRemoveNote: next.onDidRemoveNote,
  };
};
