import { Graph, Edge } from 'graphlib'


export interface BubbleLink {
  from: string
  to: string
  text: string
}


export class Bubble {
  public id: string
  public title: string
  public source: string
  public path: string
  public links: BubbleLink[]

  constructor(id: string, title: string, links: BubbleLink[], path: string, source: string) {
    this.id = id
    this.title = title
    this.source = source
    this.path = path
    this.links = links
  }

  public getForwardLinks(): BubbleLink[] {
    return this.links.filter(link => link.from === this.id)
  }

  public getBacklinks(): BubbleLink[] {
    return this.links.filter(link => link.from === this.id)
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
      this.graph.setEdge(link.from, link.to, link.text)
    })
  }

  public getBubbles(): Bubble[] {
    return this.graph.nodes()
      .map(id => this.graph.node(id))
  }

  public getBubble(bubbleId: string): Bubble {
    if (this.graph.hasNode(bubbleId)) {
      return this.graph.node(bubbleId)
    }
    throw new Error(`Bubble with ID [${bubbleId}] not found`)
  }

  public getAllLinks(bubbleId: string): BubbleLink[] {
    return (this.graph.nodeEdges(bubbleId) || [])
      .map(edge => convertEdgeToBubbleLink(edge))
  }

  public getForwardLinks(bubbleId: string): BubbleLink[] {
    return (this.graph.outEdges(bubbleId) || [])
      .map(edge => convertEdgeToBubbleLink(edge))
  }

  public getBacklinks(bubbleId: string): BubbleLink[] {
    return (this.graph.inEdges(bubbleId) || [])
      .map(edge => convertEdgeToBubbleLink(edge))
  }
}


const convertEdgeToBubbleLink = (edge: Edge): BubbleLink => ({
  from: edge.v,
  to: edge.w,
  text: edge.name || edge.w,
})


