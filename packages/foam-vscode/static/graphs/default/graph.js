try {
  const vscode = acquireVsCodeApi();

  window.addEventListener("message", event => {
    const message = event.data;

    switch (message.type) {
      case "refresh":
        const data = message.payload;
        createWebGLGraph(data, vscode);
        break;
      case "selected":
        const noteId = message.payload;
        const node = myGraph.graphData().nodes.find(node => node.id === noteId);
        if (node) {
          myGraph.centerAt(node.x, node.y, 300).zoom(3, 300);
          model = updateModel(node, null);
        }
        break;
    }
  });
} catch {
  console.log("VsCode not detected");
}

const CONTAINER_ID = "graph";

const style = {
  backgroundColor: "#202020",
  node: {
    note: "#277da1",
    nonExistingNote: "#545454",
    attachment: "#43aa8b",
    externalResource: "#f8961e",
    tag: "#f3722c",
    unknown: "#f94144"
  },
  link: {
    highlighted: "#f9c74f",
    regular: "#055171"
  }
};

const sizeScale = d3
  .scaleLinear()
  .domain([0, 30])
  .range([1, 3])
  .clamp(true);

const labelAlpha = d3
  .scaleLinear()
  .domain([1.2, 2])
  .range([0, 1])
  .clamp(true);

const globalFontSize = 12;

const myGraph = ForceGraph();
let model = updateModel(null, null);

function createWebGLGraph(data, channel) {
  data = convertData(data);

  const elem = document.getElementById(CONTAINER_ID);
  myGraph(elem)
    .graphData(data)
    .backgroundColor(style.backgroundColor)
    .linkHoverPrecision(8)
    .d3Force("x", d3.forceX())
    .d3Force("y", d3.forceY())
    .d3Force("collide", d3.forceCollide(myGraph.nodeRelSize()))
    .linkWidth(0.5)
    .linkDirectionalParticles(1)
    .linkDirectionalParticleWidth(link =>
      getLinkState(link, model) === "highlighted" ? 1 : 0
    )
    .nodeVal(node => sizeScale(node.nInLinks + node.nOutLinks))
    .nodeLabel("")
    .nodeCanvasObject((node, ctx, globalScale) => {
      const size = sizeScale(node.nInLinks + node.nOutLinks);
      const fontSize = globalFontSize / globalScale;
      const { fill, border } = getNodeColor(node, model);
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

      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      let textColor = d3.rgb(fill);
      textColor.opacity =
        getNodeState(node, model) === "highlighted"
          ? 1
          : labelAlpha(globalScale);
      ctx.fillStyle = textColor;
      ctx.fillText(node.name, node.x, node.y + size + 1);
    })
    .linkColor(link => getLinkColor(link, model))
    .onNodeHover(node => {
      model = updateModel(model.selectedNode, node);
    })
    .onNodeClick((node, event) => {
      if (event.getModifierState("Control") || event.getModifierState("Meta")) {
        channel.postMessage({
          type: "selected",
          payload: node.id
        });
      }
      model = updateModel(node, model.hoverNode);
    })
    .onBackgroundClick(e => {
      model = updateModel(null, model.hoverNode);
    });
}

function convertData(raw) {
  data = {
    nodes: raw.nodes.map(n => ({
      ...n,
      name: n.title,
      neighbors: [],
      links: []
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
  return data;
}

function getNodeColor(node, model) {
  const typeFill = style.node[node.type || "unknown"];
  switch (getNodeState(node, model)) {
    case "regular":
      return { fill: typeFill, border: typeFill };
    case "lessened":
      const darker = d3.hsl(typeFill).darker(3);
      return { fill: darker, border: darker };
    case "highlighted":
      return { fill: typeFill, border: "#f9c74f" };
    default:
      throw new Error("Unknown type for node", node);
  }
}

function getLinkColor(link, model) {
  switch (getLinkState(link, model)) {
    case "regular":
      return style.link.regular;
    case "highlighted":
      return style.link.highlighted;
    case "lessened":
      return d3.hsl(style.link.regular).darker(3);
    default:
      throw new Error("Unknown type for link", link);
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
  return model.focusNodes.size === 0
    ? "regular"
    : model.focusLinks.has(link)
    ? "highlighted"
    : "lessened";
}

function updateModel(selectedNode, hoverNode) {
  const focusNodes = new Set();
  const focusLinks = new Set();
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
    hoverNode: hoverNode
  };
}

// For testing
window.onload = () => {
  if (window.data) {
    createWebGLGraph(window.data, {
      postMessage: message => console.log("message", message)
    });
  }
};
