const CONTAINER_ID = "graph";

let data = {
  nodes: [{ id: "node1", label: "Loading.." }],
  edges: []
};

function loadGraph(data) {
  // createD3Graph(data, "graph");
  createWebGLGraph(data, "graph");
  // createD6Graph(data, "graph");
}

window.onload = () => {
  if (window.data) {
    loadGraph(window.data);
  }
};

window.addEventListener("message", event => {
  const message = event.data;

  switch (message.type) {
    case "refresh":
      const data = message.payload;
      loadGraph(data);
      break;
  }
});

function createWebGLGraph(data) {
  const COLORS = {
    note: "#999",
    nonExistingNote: "#333",
    attachment: "green",
    externalResource: "blue",
    tag: "orange",
    unknown: "red"
  };
  const BACKGROUND_COLOR = "#202020";

  data = {
    nodes: data.nodes.map(n => ({ ...n, name: n.title })),
    links: data.edges
  };
  var myGraph = ForceGraph();
  const sizeScale = d3
    .scaleLinear()
    .domain([0, 30])
    .range([4, 10])
    .clamp(true);

  const highlightNodes = new Set();
  const highlightLinks = new Set();

  const elem = document.getElementById(CONTAINER_ID);

  const support = data.nodes.reduce((acc, node, idx) => {
    acc[node.id] = idx;
    return acc;
  }, {});
  data.links.forEach(link => {
    const a = data.nodes[support[link.source]];
    const b = data.nodes[support[link.target]];
    !a.neighbors && (a.neighbors = []);
    !b.neighbors && (b.neighbors = []);
    a.neighbors.push(b);
    b.neighbors.push(a);

    !a.links && (a.links = []);
    !b.links && (b.links = []);
    a.links.push(link);
    b.links.push(link);
  });
  data.nodes.forEach(node => {
    !node.neighbors && (node.neighbors = []);
    !node.links && (node.links = []);
  });

  function getNodeStatus(node) {
    return highlightNodes.size === 0
      ? "regular"
      : highlightNodes.has(node)
      ? "highlighted"
      : "lessened";
  }

  function getLinkStatus(link) {
    return highlightLinks.size === 0
      ? "regular"
      : highlightLinks.has(link)
      ? "highlighted"
      : "lessened";
  }

  myGraph(elem)
    .graphData(data)
    .backgroundColor(BACKGROUND_COLOR)
    .linkHoverPrecision(8)
    .d3Force("x", d3.forceX())
    .d3Force("y", d3.forceY())
    .nodeVal(node => sizeScale(node.nInLinks + node.nOutLinks))
    .nodeCanvasObject((node, ctx) => {
      const size = sizeScale(node.nInLinks + node.nOutLinks);
      let borderColor = "";
      let circleColor = "";
      switch (getNodeStatus(node)) {
        case "regular":
          circleColor = COLORS[node.type || "unknown"];
          borderColor = circleColor;
          break;
        case "lessened":
          circleColor = "#333";
          borderColor = circleColor;
          break;
        case "highlighted":
          circleColor = COLORS[node.type || "unknown"];
          borderColor = "white";
          break;
      }
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 0.5, 0, 2 * Math.PI, false);
      ctx.fillStyle = borderColor;
      ctx.fill();
      ctx.closePath();
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
      ctx.fillStyle = circleColor;
      ctx.fill();
      ctx.closePath();
    })
    .linkColor(link => {
      switch (getLinkStatus(link)) {
        case "highlighted":
          return "#483699";
        case "regular":
          return "#999";
        case "lessened":
          return "#333";
      }
    })
    .linkDirectionalParticles(1)
    .linkDirectionalParticleWidth(link => (highlightLinks.has(link) ? 2 : 0))
    .onNodeHover(node => {
      highlightNodes.clear();
      highlightLinks.clear();
      if (node) {
        highlightNodes.add(node);
        node.neighbors.forEach(neighbor => highlightNodes.add(neighbor));
        node.links.forEach(link => highlightLinks.add(link));
      }

      hoverNode = node || null;
    })
    .onNodeClick(node => {})
    .onBackgroundClick(e => {});
}

function createD3Graph(data) {
  const CANVAS_STYLE = `
svg {
  background-color: #202020;
  font: 12px sans-serif;
}
.node {
  fill: #999;
  stroke: #999;
}
.node:hover, .node.non-existing:hover {
  fill: #483699;
  stroke: white;
  z-index: 10000;
}
.edge {
  stroke: #999;
  stroke-opacity: 0.6;
}
.node.non-existing {
  fill: #333;
  stroke: #333;
}
.label {
  pointer-events: none;
  z-index: 1000000;
  color: white;
}

.with-selection .edge {
  opacity: 0.2;
}
.node.selected {
  fill: #483699;
  stroke: white;
  opacity: 1;
}
.node.hidden {
  opacity: 0.2;
}
.edge.selectedFirstDegree {
  stroke: #483699;
  opacity: 1;
}
.selectedFirstDegree .node {
  opacity: 1;
  fill: white;
  stroke: white;
}
`;
  const links = data.edges.map(d => Object.create(d));
  const nodes = data.nodes.map(d => Object.create({ ...d, radius: 5 }));

  const width = window.innerWidth;
  const height = window.innerHeight;
  const k = height / width;

  const drag = simulation => {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  };

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3.forceLink(links).id(d => d.id)
    )
    .force("charge", d3.forceManyBody().strength(-60))
    .force("x", d3.forceX())
    .force("y", d3.forceY());

  function onNodeSelected(event) {
    const selectionIdx = this.__data__.index;
    d3.selection().classed("with-selection", true);
    d3.select(this).classed("selected", true);

    const neighbors = link
      .filter(
        d => d.source.index === selectionIdx || d.target.index === selectionIdx
      )
      .classed("selectedFirstDegree", true)
      .nodes()
      .map(n => n.__data__)
      .reduce(
        (acc, link) => acc.add(link.source.index).add(link.target.index),
        new Set()
      );

    node
      .selectAll("circle")
      .classed("selectedFirstDegree", d => neighbors.has(d.index))
      .classed("hidden", d => !neighbors.has(d.index));
  }

  function onCanvasClick(event) {
    d3.selectAll(".selected").classed("selected", false);
    d3.selectAll(".selectedFirstDegree").classed("selectedFirstDegree", false);
    d3.selection().classed("with-selection", false);
  }

  function onNodeEnter(event) {
    d3.select(this.parentNode)
      .raise()
      .append("text")
      .attr("x", 0)
      .attr("y", 30)
      .style("text-anchor", "middle")
      .classed("label", true)
      .text(d => d.title);
  }

  function onNodeExit(event) {
    d3.select(this.parentNode)
      .selectAll("text")
      .remove();
  }

  let showingLabels = false;
  const zoom = d3
    .zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", ({ transform }) => {
      canvas.attr("transform", transform).attr("stroke-width", 5 / transform.k);
      if (transform.k > 2.5 && !showingLabels) {
        node
          .append("text")
          .attr("x", 0)
          .attr("y", 0)
          .style("text-anchor", "middle")
          .classed("label", true)
          .text(d => d.title);
        showingLabels = true;
      }
      if (transform.k < 2.5 && showingLabels) {
        node.selectAll("text").remove();
        showingLabels = false;
      }
    });

  const svg = d3
    .create("svg")
    .attr("viewBox", [-width / 2, -height / 2, width, height]);

  svg.append("style").text(CANVAS_STYLE);
  const canvas = svg.append("g").classed("canvas", true);

  const bg = canvas
    .append("rect")
    .attr("y", "-500%")
    .attr("x", "-500%")
    .attr("width", "1000%")
    .attr("height", "1000%")
    .style("fill", "transparent")
    .on("click", onCanvasClick);

  const link = canvas
    .append("g")
    .style("pointer-events", "none")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", 1)
    .classed("edge", true);

  const node = canvas
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .call(drag(simulation));

  const sizeScale = d3
    .scaleLinear()
    .domain([0, 30])
    .range([3, 6])
    .clamp(true);

  node
    .append("circle")
    .attr("r", d => sizeScale(d.nInLinks + d.nOutLinks))
    .attr("stroke-width", 1)
    .classed("node", true)
    .classed("non-existing", d => d.uri === "orphan")
    .on("click", onNodeSelected)
    .on("mouseenter", onNodeEnter)
    .on("mouseout", onNodeExit);

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  const graphNode = svg
    .call(zoom)
    .call(zoom.transform, d3.zoomIdentity)
    .node();

  document.getElementById(CONTAINER_ID).append(graphNode);
}

function createD6Graph(data) {
  const graph = new G6.Graph({
    container: CONTAINER_ID,
    width: window.innerWidth,
    height: window.innerHeight,
    animate: true,
    modes: {
      default: [
        "drag-canvas",
        {
          type: "zoom-canvas",
          sensitivity: 0.3,
          minZoom: 0.4,
          maxZoom: 1.2,
          fixSelectedItems: {
            fixLabel: true
          }
        },
        "drag-node"
      ]
    },
    layout: {
      type: "force",
      preventOverlap: true,
      linkDistance: 100
      // type: 'circular',
      // radius: 1000,
      // clockwise: false,
      // ordering: 'degree',
      // angleRatio: 1,
    },
    defaultNode: {
      size: 15,
      style: {
        fill: "#999",
        color: "#999",
        stroke: "#999"
      },
      labelCfg: {
        position: "bottom",
        style: {
          fill: "#FFF",
          fontSize: 14,
          lineWidth: 0
        }
      }
    },
    defaultEdge: {
      size: 1,
      color: "#333"
      // type: 'arc',
      // curveOffset: 80
    },

    nodeStateStyles: {
      hover: {
        fill: "lightsteelblue"
      },
      selected: {
        stroke: "#FFF",
        lineWidth: 2
      },
      selectedFirstDegree: {
        stroke: "#FFF",
        lineWidth: 1
      }
    },
    edgeStateStyles: {
      selectedFirstDegree: {
        stroke: "#FFF"
      }
    }
  });

  // Mouse enter a node
  graph.on("node:mouseenter", e => {
    const nodeItem = e.item; // Get the target item
    graph.setItemState(nodeItem, "hover", true); // Set the state 'hover' of the item to be true
  });

  // Mouse leave a node
  graph.on("node:mouseleave", e => {
    const nodeItem = e.item; // Get the target item
    graph.setItemState(nodeItem, "hover", false); // Set the state 'hover' of the item to be false
  });

  // Click a node
  graph.on("node:click", e => {
    const oldSelected = graph.findAllByState("node", "selected");
    oldSelected.forEach(cn => {
      graph.setItemState(cn, "selected", false);
      cn.getNeighbors().forEach(neighbor => {
        graph.setItemState(neighbor, "selectedFirstDegree", false);
      });
      cn.getEdges().forEach(edge => {
        graph.setItemState(edge, "selectedFirstDegree", false);
      });
      graph.updateItem(cn, {
        label: ""
      });
    });

    const nodeItem = e.item;
    graph.setItemState(nodeItem, "selected", true);
    nodeItem.getNeighbors().forEach(neighbor => {
      graph.setItemState(neighbor, "selectedFirstDegree", true);
    });
    nodeItem.getEdges().forEach(edge => {
      graph.setItemState(edge, "selectedFirstDegree", true);
    });
    graph.updateItem(nodeItem, {
      label: nodeItem.getModel().title
    });
  });

  function refreshDragedNodePosition(e) {
    const model = e.item.get("model");
    model.fx = e.x;
    model.fy = e.y;
  }
  graph.on("node:dragstart", function(e) {
    graph.layout();
    refreshDragedNodePosition(e);
  });
  graph.on("node:drag", function(e) {
    const forceLayout = graph.get("layoutController").layoutMethod;
    forceLayout.execute();
    refreshDragedNodePosition(e);
  });
  graph.on("node:dragend", function(e) {
    e.item.get("model").fx = null;
    e.item.get("model").fy = null;
  });

  graph.data(data);
  graph.node(node => {
    const size = Math.max((node.nInLinks + node.nOutLinks + 1) * 3, 15);
    return {
      ...node,
      size: size
    };
  });
  graph.render();
  return graph;
}
