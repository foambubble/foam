import { Graph, Edge } from 'graphlib';
import { Position, Point } from 'unist';
import GithubSlugger from 'github-slugger';
import { EventEmitter } from 'events';

type ID = string;

export interface Link {
  from: ID;
  to: ID;
  text: string;
}

export interface NoteLink {
  to: ID;
  text: string;
  position: Position;
}

export interface NoteLinkDefinition {
  label: string;
  url: string;
  title?: string;
  position?: Position;
}

export class Note {
  public id: ID;
  public frontmatter: object;
  public title: string | null;
  public source: string;
  public path: string;
  public start: Point;
  public end: Point;
  public eol: string;
  public links: NoteLink[];
  public definitions: NoteLinkDefinition[];

  constructor(
    id: ID,
    frontmatter: object,
    title: string | null,
    links: NoteLink[],
    definitions: NoteLinkDefinition[],
    start: Point,
    end: Point,
    path: string,
    source: string,
    eol: string
  ) {
    this.id = id;
    this.frontmatter = frontmatter;
    this.title = title;
    this.source = source;
    this.path = path;
    this.links = links;
    this.definitions = definitions;
    this.start = start;
    this.end = end;
    this.eol = eol;
  }
}

export type NoteGraphEventHandler = (e: { note: Note }) => void;

export class NoteGraph {
  private graph: Graph;
  private events: EventEmitter;

  constructor() {
    this.graph = new Graph();
    this.events = new EventEmitter();
  }

  public setNote(note: Note) {
    const noteExists = this.graph.hasNode(note.id);
    if (noteExists) {
      (this.graph.outEdges(note.id) || []).forEach(edge => {
        this.graph.removeEdge(edge);
      });
    }

    this.graph.setNode(note.id, note);
    note.links.forEach(link => {
      const slugger = new GithubSlugger();
      this.graph.setEdge(note.id, slugger.slug(link.to), link.text);
    });

    this.events.emit(noteExists ? 'update' : 'add', { note });
  }

  public getNotes(): Note[] {
    return this.graph.nodes().map(id => this.graph.node(id));
  }

  public getNote(noteId: ID): Note | void {
    if (this.graph.hasNode(noteId)) {
      return this.graph.node(noteId);
    }
    throw new Error(`Note with ID [${noteId}] not found`);
  }

  public getAllLinks(noteId: ID): Link[] {
    return (this.graph.nodeEdges(noteId) || []).map(edge =>
      convertEdgeToLink(edge, this.graph)
    );
  }

  public getForwardLinks(noteId: ID): Link[] {
    return (this.graph.outEdges(noteId) || []).map(edge =>
      convertEdgeToLink(edge, this.graph)
    );
  }

  public getBacklinks(noteId: ID): Link[] {
    return (this.graph.inEdges(noteId) || []).map(edge =>
      convertEdgeToLink(edge, this.graph)
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

const convertEdgeToLink = (edge: Edge, graph: Graph): Link => ({
  from: edge.v,
  to: edge.w,
  text: graph.edge(edge.v, edge.w),
});
