import { Graph, Edge } from 'graphlib'


type ID = string

export interface Link {
  from: ID
  to: ID
  text: string
}

export interface NoteLink {
  to: ID
  text: string
}


export class Note {
  public id: ID
  public title: string
  public source: string
  public path: string
  public links: NoteLink[]

  constructor(id: ID, title: string, links: NoteLink[], path: string, source: string) {
    this.id = id
    this.title = title
    this.source = source
    this.path = path
    this.links = links
  }
}


export class NoteGraph {
  private graph: Graph

  constructor() {
    this.graph = new Graph()
  }

  public setNote(note: Note) {
    if (this.graph.hasNode(note.id)) {
      (this.graph.outEdges(note.id) || []).forEach(edge => {
        this.graph.removeEdge(edge)
      })
    }
    this.graph.setNode(note.id, note)
    note.links.forEach(link => {
      this.graph.setEdge(note.id, link.to, link.text)
    })
  }

  public getNotes(): Note[] {
    return this.graph.nodes()
      .map(id => this.graph.node(id))
  }

  public getNote(noteId: ID): Note {
    if (this.graph.hasNode(noteId)) {
      return this.graph.node(noteId)
    }
    throw new Error(`Note with ID [${noteId}] not found`)
  }

  public getAllLinks(noteId: ID): Link[] {
    return (this.graph.nodeEdges(noteId) || [])
      .map(edge => convertEdgeToLink(edge))
  }

  public getForwardLinks(noteId: ID): Link[] {
    return (this.graph.outEdges(noteId) || [])
      .map(edge => convertEdgeToLink(edge))
  }

  public getBacklinks(noteId: ID): Link[] {
    return (this.graph.inEdges(noteId) || [])
      .map(edge => convertEdgeToLink(edge))
  }
}


const convertEdgeToLink = (edge: Edge): Link => ({
  from: edge.v,
  to: edge.w,
  text: edge.name || edge.w,
})


