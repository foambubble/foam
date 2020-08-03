import { Graph } from 'graphlib';
import { EventEmitter } from 'events';
import { Position, Point, URI, ID } from './types';
import { uriToSlug, hashURI, getUriViaRelative } from './utils';

export interface NoteSource {
  uri: URI;
  text: string;
  contentStart: Point;
  end: Point;
  eol: string;
}

export interface WikiLink {
  type: 'wikilink';
  text: string;
  slug: string;
  position: Position;
}

export type NoteLink = WikiLink;

export interface NoteInfo {
  title: string | null;
  properties: object;
  // sections: NoteSection[]
  // tags: NoteTag[]
  links: NoteLink[];
  definitions: NoteLinkDefinition[];
  source: NoteSource;
}

export type Note = NoteInfo & {
  id: ID;
  slug: string; // note: this slug is not necessarily unique
};

export interface Connection {
  from: ID;
  to: ID;
  link: NoteLink;
}

export interface NoteLinkDefinition {
  label: string;
  url: string;
  title?: string;
  position?: Position;
}

export type NoteGraphEventHandler = (e: { note: Note }) => void;

export type NoteQuery = {
  id?: ID;
  slug?: string;
  uri?: URI;
  title?: string;
};

export class NoteGraph {
  private graph: Graph;
  private events: EventEmitter;
  private createIdFromURI: (uri: URI) => ID;

  constructor() {
    this.graph = new Graph();
    this.events = new EventEmitter();
    this.createIdFromURI = hashURI;
  }

  public setNote(note: NoteInfo) {
    const id = this.createIdFromURI(note.source.uri);
    const slug = uriToSlug(note.source.uri);
    const noteExists = this.graph.hasNode(id);
    if (noteExists) {
      (this.graph.outEdges(id) || []).forEach(edge => {
        this.graph.removeEdge(edge);
      });
    }
    const graphNote: Note = {
      ...note,
      id: id,
      slug: slug,
    };
    this.graph.setNode(id, graphNote);
    note.links.forEach(link => {
      const relativePath =
        note.definitions.find(def => def.label === link.slug)?.url ?? link.slug;
      const targetPath = getUriViaRelative(note.source.uri, relativePath);
      const targetId = this.createIdFromURI(targetPath);
      const connection: Connection = {
        from: graphNote.id,
        to: targetId,
        link: link,
      };
      this.graph.setEdge(graphNote.id, targetId, connection);
    });
    this.events.emit(noteExists ? 'update' : 'add', { note: graphNote });
    return graphNote;
  }

  public getNotes(): Note[] {
    return this.graph
      .nodes()
      .map(id => this.graph.node(id))
      .filter(Boolean);
  }

  public getNoteId(query: NoteQuery): ID | null {
    if (query.id) {
      return query.id;
    }
    const searchFn = query.uri
      ? (note: Note | null) => note?.source.uri === query.uri
      : query.slug
      ? (note: Note | null) => note?.slug === query.slug
      : query.title
      ? (note: Note | null) => note?.title === query.title
      : null;
    if (searchFn) {
      const foundId = this.graph.nodes().find(nodeId => {
        const note = this.graph.node(nodeId);
        return searchFn(note);
      });
      return foundId ?? null;
    }
    return null;
  }

  public getNote(query: NoteQuery): Note | null {
    const noteId = this.getNoteId(query);
    return noteId ? this.graph.node(noteId) ?? null : null;
  }

  public getAllLinks(query: NoteQuery): Connection[] {
    const noteId = this.getNoteId(query);
    return noteId != null
      ? (this.graph.nodeEdges(noteId) || []).map(edge =>
          this.graph.edge(edge.v, edge.w)
        )
      : [];
  }

  public getForwardLinks(query: NoteQuery): Connection[] {
    const noteId = this.getNoteId(query);
    return noteId != null
      ? (this.graph.outEdges(noteId) || []).map(edge =>
          this.graph.edge(edge.v, edge.w)
        )
      : [];
  }

  public getBacklinks(query: NoteQuery): Connection[] {
    const noteId = this.getNoteId(query);
    return noteId != null
      ? (this.graph.inEdges(noteId) || []).map(edge =>
          this.graph.edge(edge.v, edge.w)
        )
      : [];
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
