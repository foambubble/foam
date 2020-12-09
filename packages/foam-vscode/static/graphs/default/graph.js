const CONTAINER_ID = "graph";

function getStyle(name, fallback) {
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name) ||
    fallback
  );
}

const style = {
  background: getStyle(`--vscode-panel-background`, "#202020"),
  fontSize: parseInt(getStyle(`--vscode-font-size`, 12)) - 2,
  highlightedForeground: getStyle(
    "--vscode-list-highlightForeground",
    "#f9c74f"
  ),
  node: {
    note: getStyle("--vscode-editor-foreground", "#277da1"),
    nonExistingNote: getStyle(
      "--vscode-list-deemphasizedForeground",
      "#545454"
    ),
    unknown: getStyle("--vscode-editor-foreground", "#f94144")
  }
};

const sizeScale = d3
  .scaleLinear()
  .domain([0, 30])
  .range([0.5, 2])
  .clamp(true);

const labelAlpha = d3
  .scaleLinear()
  .domain([1.2, 2])
  .range([0, 1])
  .clamp(true);

let model = {
  selectedNodes: new Set(),
  hoverNode: null,
  focusNodes: new Set(),
  focusLinks: new Set(),
  nodeInfo: {},
  data: {
    nodes: [],
    links: []
  }
};
const graph = ForceGraph();

function update(patch) {
  // Apply the patch function to the model..
  patch(model);
  // ..then compute the derived state

  // compute highlighted elements
  const focusNodes = new Set();
  const focusLinks = new Set();
  if (model.hoverNode) {
    focusNodes.add(model.hoverNode);
    const info = model.nodeInfo[model.hoverNode];
    info.neighbors.forEach(neighborId => focusNodes.add(neighborId));
    info.links.forEach(link => focusLinks.add(link));
  }
  if (model.selectedNodes) {
    model.selectedNodes.forEach(nodeId => {
      focusNodes.add(nodeId);
      const info = model.nodeInfo[nodeId];
      info.neighbors.forEach(neighborId => focusNodes.add(neighborId));
      info.links.forEach(link => focusLinks.add(link));
    });
  }
  model.focusNodes = focusNodes;
  model.focusLinks = focusLinks;
}

const Actions = {
  refresh: graphInfo =>
    update(m => {
      m.nodeInfo = graphInfo.nodes;
      const links = graphInfo.links;

      // compute graph delta, for smooth transitions we need to mutate objects in-place
      const remaining = new Set(Object.keys(m.nodeInfo));
      m.data.nodes.forEach((node, index, object) => {
        if (remaining.has(node.id)) {
          remaining.delete(node.id);
        } else {
          object.splice(index, 1); // delete the element
        }
      });
      remaining.forEach(nodeId => {
        m.data.nodes.push({
          id: nodeId
        });
      });
      m.data.links = links; // links can be swapped out without problem

      // check that selected/hovered nodes are still valid (see #397)
      m.hoverNode = remaining.has(m.hoverNode) ? m.hoverNode : null;
      m.selectedNodes = new Set(
        Array.from(m.selectedNodes).filter(nId => remaining.has(nId))
      );

      // annoying we need to call this function, but I haven't found a good workaround
      graph.graphData(m.data);
    }),
  selectNode: (nodeId, isAppend) =>
    update(m => {
      if (!isAppend) {
        m.selectedNodes.clear();
      }
      if (nodeId != null) {
        m.selectedNodes.add(nodeId);
      }
    }),
  highlightNode: nodeId =>
    update(m => {
      m.hoverNode = nodeId;
    })
};

function initDataviz(channel) {
  const elem = document.getElementById(CONTAINER_ID);
  graph(elem)
    .graphData(model.data)
    .backgroundColor(style.background)
    .linkHoverPrecision(8)
    .d3Force("x", d3.forceX())
    .d3Force("y", d3.forceY())
    .d3Force("collide", d3.forceCollide(graph.nodeRelSize()))
    .linkWidth(0.2)
    .linkDirectionalParticles(1)
    .linkDirectionalParticleWidth(link =>
      getLinkState(link, model) === "highlighted" ? 1 : 0
    )
    .nodeCanvasObject((node, ctx, globalScale) => {
      const info = model.nodeInfo[node.id];
      const size = sizeScale(info.neighbors.length);
      const { fill, border } = getNodeColor(node.id, model);
      const fontSize = style.fontSize / globalScale;
      let textColor = d3.rgb(fill);
      textColor.opacity =
        getNodeState(node.id, model) === "highlighted"
          ? 1
          : labelAlpha(globalScale);
      const label = info.title;

      Draw(ctx)
        .circle(node.x, node.y, size + 0.2, border)
        .circle(node.x, node.y, size, fill)
        .text(label, node.x, node.y + size + 1, fontSize, textColor);
    })
    .linkColor(link => getLinkColor(link, model))
    .onNodeHover(node => {
      Actions.highlightNode(node?.id);
    })
    .onNodeClick((node, event) => {
      if (event.getModifierState("Control") || event.getModifierState("Meta")) {
        channel.postMessage({
          type: "webviewDidSelectNode",
          payload: node.id
        });
      }
      Actions.selectNode(node.id, event.getModifierState("Shift"));
    })
    .onBackgroundClick(event => {
      Actions.selectNode(null, event.getModifierState("Shift"));
    });
}

function augmentGraphInfo(data) {
  Object.values(data.nodes).forEach(node => {
    node.neighbors = [];
    node.links = [];
  });
  data.links.forEach(link => {
    const a = data.nodes[link.source];
    const b = data.nodes[link.target];
    a.neighbors.push(b.id);
    b.neighbors.push(a.id);
    a.links.push(link);
    b.links.push(link);
  });
  return data;
}

function getNodeColor(nodeId, model) {
  const info = model.nodeInfo[nodeId];
  const typeFill = style.node[info.type || "unknown"];
  switch (getNodeState(nodeId, model)) {
    case "regular":
      return { fill: typeFill, border: typeFill };
    case "lessened":
      const darker = d3.hsl(typeFill).darker(3);
      return { fill: darker, border: darker };
    case "highlighted":
      return {
        fill: typeFill,
        border: style.highlightedForeground
      };
    default:
      throw new Error("Unknown type for node", nodeId);
  }
}

function getLinkColor(link, model) {
  switch (getLinkState(link, model)) {
    case "regular":
      return d3.hsl(style.node.note).darker(2);
    case "highlighted":
      return style.highlightedForeground;
    case "lessened":
      return d3.hsl(style.node.note).darker(4);
    default:
      throw new Error("Unknown type for link", link);
  }
}

function getNodeState(nodeId, model) {
  return model.selectedNodes.has(nodeId) || model.hoverNode === nodeId
    ? "highlighted"
    : model.focusNodes.size === 0
    ? "regular"
    : model.focusNodes.has(nodeId)
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

const Draw = ctx => ({
  circle: function(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
    return this;
  },
  text: function(text, x, y, size, color) {
    ctx.font = `${size}px Sans-Serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    return this;
  }
});

// init the app
try {
  const vscode = acquireVsCodeApi();

  window.onload = () => {
    initDataviz(vscode);
    console.log("ready");
    vscode.postMessage({
      type: "webviewDidLoad"
    });
  };
  window.addEventListener("error", error => {
    vscode.postMessage({
      type: "error",
      payload: {
        message: error.message,
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
        error: error.error
      }
    });
  });

  window.addEventListener("message", event => {
    const message = event.data;

    switch (message.type) {
      case "didUpdateGraphData":
        const graphData = augmentGraphInfo(message.payload);
        console.log("didUpdateGraphData", graphData);
        Actions.refresh(graphData);
        break;
      case "didSelectNote":
        const noteId = message.payload;
        const node = graph.graphData().nodes.find(node => node.id === noteId);
        if (node) {
          graph.centerAt(node.x, node.y, 300).zoom(3, 300);
          Actions.selectNode(noteId);
        }
        break;
    }
  });
} catch {
  console.log("VsCode not detected");
}

window.addEventListener("resize", () => {
  graph.width(window.innerWidth).height(window.innerHeight);
});

// For testing
if (window.data) {
  console.log("Test mode");
  window.model = model;
  window.graph = graph;
  window.onload = () => {
    initDataviz({
      postMessage: message => console.log("message", message)
    });
    const graphData = augmentGraphInfo(window.data);
    Actions.refresh(graphData);
  };
}
