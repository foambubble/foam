import { Graph, Edge } from 'graphlib';
import { Position, Point } from 'unist';

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
  public title: string;
  public source: string;
  public path: string;
  public end: Point;
  public eol: string;
  public links: NoteLink[];
  public definitions: NoteLinkDefinition[];

  constructor(
    id: ID,
    title: string,
    links: NoteLink[],
    definitions: NoteLinkDefinition[],
    end: Point,
    path: string,
    source: string,
    eol: string
  ) {
    this.id = id;
    this.title = title;
    this.source = source;
    this.path = path;
    this.links = links;
    this.definitions = definitions;
    this.end = end;
    this.eol = eol;
  }
}

export class NoteGraph {
  private graph: Graph;

  constructor() {
    this.graph = new Graph();
  }

  public setNote(note: Note) {
    if (this.graph.hasNode(note.id)) {
      (this.graph.outEdges(note.id) || []).forEach(edge => {
        this.graph.removeEdge(edge);
      });
    }
    this.graph.setNode(note.id, note);
    note.links.forEach(link => {
      this.graph.setEdge(note.id, link.to, link.text);
    });
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

  // Note: This is temporary until we figure out how to put 
  // position inside Link (needed for linting)
  public getNoteLinks(noteId: ID): NoteLink[] {
    const note = this.getNote(noteId);
    return note ? note.links : [];
  }

  public getAllLinks(noteId: ID): Link[] {
    return (this.graph.nodeEdges(noteId) || []).map(edge =>
      convertEdgeToLink(edge)
    );
  }

  public getForwardLinks(noteId: ID): Link[] {
    return (this.graph.outEdges(noteId) || []).map(edge =>
      convertEdgeToLink(edge)
    );
  }

  public getBacklinks(noteId: ID): Link[] {
    return (this.graph.inEdges(noteId) || []).map(edge =>
      convertEdgeToLink(edge)
    );
  }
}

const convertEdgeToLink = (edge: Edge): Link => ({
  from: edge.v,
  to: edge.w,
  text: edge.name || edge.w,
});
