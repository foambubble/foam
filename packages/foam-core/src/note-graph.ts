import { Graph } from 'graphlib';
import { EventEmitter } from 'events';
import { Position, Point, URI, ID } from './types';
import { hashURI, computeRelativeURI } from './utils';

export interface NoteSource {
  uri: URI;
  text: string;
  contentStart: Point;
  end: Point;
  eol: string;
}

export interface WikiLink {
  type: 'wikilink';
  slug: string;
  position: Position;
}

// at the moment we only model wikilink
export type NoteLink = WikiLink;

export interface NoteLinkDefinition {
  label: string;
  url: string;
  title?: string;
  position?: Position;
}

export interface Note {
  title: string | null;
  slug: string; // note: this slug is not necessarily unique
  properties: object;
  // sections: NoteSection[]
  // tags: NoteTag[]
  links: NoteLink[];
  definitions: NoteLinkDefinition[];
  source: NoteSource;
}

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

export class NoteGraph {
  private graph: Graph;
  private events: EventEmitter;
  private createIdFromURI: (uri: URI) => ID;

  constructor() {
    this.graph = new Graph();
    this.events = new EventEmitter();
    this.createIdFromURI = hashURI;
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
