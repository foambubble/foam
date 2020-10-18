try {
  const vscode = acquireVsCodeApi();

  window.addEventListener("message", event => {
    const message = event.data;

    switch (message.type) {
      case "refresh":
        const data = message.payload;
        createWebGLGraph(data, vscode);
        break;
      }
    });
} catch {
  console.log("VSCode not detected")
}

const CONTAINER_ID = "graph";

const style = {
  backgroundColor: "#202020",
  node: {
    note: "#277da1",
    nonExistingNote: "#577590",
    attachment: "#43aa8b",
    externalResource: "#f8961e",
    tag: "#f3722c",
    unknown: "#f94144"
  },
  link: {
    highlighted: "#f9c74f",
    regular: "#277da1",
  },
};

const sizeScale = d3.scaleLinear()
  .domain([0, 30]).range([4, 10])
  .clamp(true);

function createWebGLGraph(data, channel) {
  data = convertData(data)
  let model = updateModel(null, null)

  const elem = document.getElementById(CONTAINER_ID)
  const myGraph = ForceGraph();
  myGraph(elem)
    .graphData(data)
    .backgroundColor(style.backgroundColor)
    .linkHoverPrecision(8)
    .d3Force("x", d3.forceX())
    .d3Force("y", d3.forceY())
    .linkDirectionalParticles(1)
    .linkDirectionalParticleWidth(
      link => getLinkState(link, model) === "highlighted" ? 2 : 0
    )
    .nodeVal(node => sizeScale(node.nInLinks + node.nOutLinks))
    .nodeCanvasObject((node, ctx) => {
      const size = sizeScale(node.nInLinks + node.nOutLinks);
      const { fill, border } = getNodeColor(node, model)
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 0.5, 0, 2 * Math.PI, false);
      ctx.fillStyle = border;
      ctx.fill();
      ctx.closePath();
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.closePath();
    })
    .linkColor(link => getLinkColor(link, model))
    .onNodeHover(node => {
      model = updateModel(model.selectedNode, node)
    })
    .onNodeClick((node, event) => {
      if (event.getModifierState("Control") || event.getModifierState("Meta")) {
        channel.postMessage({
          type: "selected",
          payload: node.id,
        });
      }
      model = updateModel(node, model.hoverNode)
    })
    .onBackgroundClick(e => {
      model = updateModel(null, model.hoverNode)
    });
}

function convertData(raw) {
  data = {
    nodes: raw.nodes.map(n => ({
      ...n,
      name: n.title,
      neighbors: [],
      links: [],
    })),
    links: raw.edges
  };

  const nodeIdToIndex = data.nodes.reduce((acc, node, idx) => {
    acc[node.id] = idx;
    return acc;
  }, {});
  data.links.forEach(link => {
    const a = data.nodes[nodeIdToIndex[link.source]];
    const b = data.nodes[nodeIdToIndex[link.target]];
    !a.neighbors && (a.neighbors = []);
    !b.neighbors && (b.neighbors = []);
    a.neighbors.push(b);
    b.neighbors.push(a);

    !a.links && (a.links = []);
    !b.links && (b.links = []);
    a.links.push(link);
    b.links.push(link);
  });
  return data
}

function getNodeColor(node, model) {
  const typeFill = style.node[node.type || "unknown"];
  switch (getNodeState(node, model)) {
    case "regular":
      return { fill: typeFill, border: typeFill}
    case "lessened":
      const darker = d3.hsl(typeFill).darker(3);
      return { fill: darker, border: darker}
    case "highlighted":
      return { fill: typeFill, border: "#f9c74f"}
    default:
      throw new Error("Unknown type for node", node)
  }
}

function getLinkColor(link, model) {
  switch(getLinkState(link, model)) {
  case "regular":
    return style.link.regular
  case "highlighted":
    return style.link.highlighted
  case "lessened":
    return d3.hsl(style.link.regular).darker(3);
  default:
    throw new Error("Unknown type for link", link)
  }
}

function getNodeState(node, model) {
  return model.selectedNode?.id === node.id || model.hoverNode?.id === node.id
    ? "highlighted"
    : model.focusNodes.size === 0
      ? "regular"
      : model.focusNodes.has(node)
        ? "regular"
        : "lessened";
}

function getLinkState(link, model) {
  return model.focusLinks.size === 0
    ? "regular"
    : model.focusLinks.has(link)
      ? "highlighted"
      : "lessened";
}

function updateModel(selectedNode, hoverNode) {
  const focusNodes = new Set()
  const focusLinks = new Set()
  if (hoverNode) {
    focusNodes.add(hoverNode);
    hoverNode.neighbors.forEach(neighbor => focusNodes.add(neighbor));
    hoverNode.links.forEach(link => focusLinks.add(link));
  }
  if (selectedNode) {
    focusNodes.add(selectedNode);
    selectedNode.neighbors.forEach(neighbor => focusNodes.add(neighbor));
    selectedNode.links.forEach(link => focusLinks.add(link));
  }
  return {
    focusNodes: focusNodes,
    focusLinks: focusLinks,
    selectedNode: selectedNode,
    hoverNode: hoverNode,
  }
}


// For testing
window.onload = () => {
  if (window.data) {
    createWebGLGraph(window.data, {
      postMessage: message => console.log("message", message)
    });
  }
};
