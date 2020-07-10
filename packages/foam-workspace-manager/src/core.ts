import { Graph, Edge } from 'graphlib'


type ID = string

export interface FoamLink {
  from: ID
  to: ID
  text: string
}

export interface OutLink {
  to: ID
  text: string
}


export class Bubble {
  public id: ID
  public title: string
  public source: string
  public path: string
  public links: OutLink[]

  constructor(id: ID, title: string, links: OutLink[], path: string, source: string) {
    this.id = id
    this.title = title
    this.source = source
    this.path = path
    this.links = links
  }
}


export class Foam {
  private graph: Graph

  constructor() {
    this.graph = new Graph()
  }

  public setBubble(bubble: Bubble) {
    if (this.graph.hasNode(bubble.id)) {
      (this.graph.outEdges(bubble.id) || []).forEach(edge => {
        this.graph.removeEdge(edge)
      })
    }
    this.graph.setNode(bubble.id, bubble)
    bubble.links.forEach(link => {
      this.graph.setEdge(bubble.id, link.to, link.text)
    })
  }

  public getBubbles(): Bubble[] {
    return this.graph.nodes()
      .map(id => this.graph.node(id))
  }

  public getBubble(bubbleId: ID): Bubble {
    if (this.graph.hasNode(bubbleId)) {
      return this.graph.node(bubbleId)
    }
    throw new Error(`Bubble with ID [${bubbleId}] not found`)
  }

  public getAllLinks(bubbleId: ID): FoamLink[] {
    return (this.graph.nodeEdges(bubbleId) || [])
      .map(edge => convertEdgeToBubbleLink(edge))
  }

  public getForwardLinks(bubbleId: ID): FoamLink[] {
    return (this.graph.outEdges(bubbleId) || [])
      .map(edge => convertEdgeToBubbleLink(edge))
  }

  public getBacklinks(bubbleId: ID): FoamLink[] {
    return (this.graph.inEdges(bubbleId) || [])
      .map(edge => convertEdgeToBubbleLink(edge))
  }
}


const convertEdgeToBubbleLink = (edge: Edge): FoamLink => ({
  from: edge.v,
  to: edge.w,
  text: edge.name || edge.w,
})


