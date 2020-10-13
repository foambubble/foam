let data = {
  nodes: [ { id: 'node1', label: 'Loading..'} ],
  edges: [],
}

window.addEventListener("message", (event) => {
  const message = event.data;

  switch (message.type) {
    case "refresh":
      const data = message.payload
      // const g = createD6Graph()
      // g.data(data)
      // g.node(node => {
      //   const size = Math.max((node.nInLinks + node.nOutLinks + 1) * 3, 15)
      //   console.log('graph', g, node, Object.assign({}, node), size)
      //   return {
      //     ...node,
      //     size: size,
      //   }
      // })
      // g.render()
      const graph = createD3Graph(data)
      window.document.getElementById('graph').append(graph)
      break
  }
})

function createD3Graph(data) {
  const links = data.edges.map(d => Object.create(d));
  const nodes = data.nodes.map(d => Object.create({...d, radius: 5}));

  const width = window.innerWidth
  const height = window.innerHeight
  const k = height / width

  const drag = simulation => {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event,d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event,d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
  }

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id))
    .force("charge", d3.forceManyBody().strength(-60))
    .force("center", d3.forceCenter(0, 0))
    .force("x", d3.forceX())
    .force("y", d3.forceY());

  function onNodeSelected(event) {
    d3.select(this)
      .classed('selected', true)
      // .transition()
      // .attr("fill", "black")
  }

  function onNodeEnter(event) {
    // d3.select(this)
      // .attr("fill", "purple")
      // .attr("stroke", "white")

    d3.select(this.parentNode)
      .raise()
      .append("text")
      .attr("x", 0)
      .attr("y", 30)
      .style("text-anchor", "middle")
      .classed("label", true)
      .text(d => d.title)
  }

  function onNodeExit(event) {
    // d3.select(this).transition()
    //   .attr("fill", "#333")
    //   .attr("stroke", "#333")

    d3.select(this.parentNode)
      .selectAll("text")
      .remove()
  }

  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", ({transform}) => {
      canvas.attr("transform", transform).attr("stroke-width", 5 / transform.k);
    });

  const svg = d3.create("svg")
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .style("font", "12px sans-serif")

  svg.append('style').text(`
  .node {
    fill: #999;
    stroke: #999;
  }
  .node:hover {
    fill: #483699;
    stroke: white;
    z-index: 10000;
  }
  .node.selected {
    fill: #483699;
    stroke: white;
  }
  .node.non-existing {
    fill: #333;
    stroke: #333;
  }
  .node.non-existing:hover {
    stroke: white;
  }
  .label {
    pointer-events: none;
    z-index: 1000000;
    stroke: white;
    stroke-width: 1px;
  }
  `)
  const canvas = svg.append("g")

  const link = canvas.append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
      .attr("stroke-width", 1) //d => Math.sqrt(d.value));

  const node = canvas.append("g")
    .attr("fill", "currentColor")
    .selectAll("g")
    .data(nodes)
    .join("g")
      .call(drag(simulation));

  const sizeScale = d3.scaleLinear()
    .domain([0, 30])
    .range([5, 10])
    .clamp(true);
  node.append("circle")
    .attr("r", d => sizeScale(d.nInLinks + d.nOutLinks))
    .attr("stroke", d => d.uri === 'orphan' ? "#333" : "#999")
    .attr("fill", d => d.uri === 'orphan' ? "#333" : "#999")
    .attr("stroke-width", 1)
    .classed("node", true)
    .classed('non-existing', d => d.uri === 'orphan')
    .on("click", onNodeSelected)
    .on("mouseenter", onNodeEnter)
    .on("mouseout", onNodeExit)

  // node.append("text")
  //   .attr("x", 8)
  //   .attr("y", "0.31em")
  //   .text(d => d.title)
  //   .clone(true)
  //   .attr("fill", "none")
  //   .attr("stroke", "white")
  //   .attr("stroke-width", 1);

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
    // svg.call(zoom)
  });

  return svg
    .call(zoom)
    .call(zoom.transform, d3.zoomIdentity)
    .node();
}


function createD6Graph() {
  const graph = new G6.Graph({
    container: 'graph',
    width: window.innerWidth,
    height: window.innerHeight,
    animate: true,
    modes: {
      default: [
        'drag-canvas',
        {
          type: 'zoom-canvas',
          sensitivity: 0.3,
          minZoom: 0.4,
          maxZoom: 1.2,
          fixSelectedItems: {
            fixLabel: true
          }
        },
        'drag-node'
      ]
    },
    layout: {
      type: 'force',
      preventOverlap: true,
      linkDistance: 100,
      // type: 'circular',
      // radius: 1000,
      // clockwise: false,
      // ordering: 'degree',
      // angleRatio: 1,
    },
    defaultNode: {
      size: 15,
      style: {
        fill: '#999',
        color: '#999',
        stroke: '#999',
      },
      labelCfg: {
        position: 'bottom',
        style: {
          fill: "#FFF",
          fontSize: 14,
          lineWidth: 0,
        }
      },
    },
    defaultEdge: {
      size: 1,
      color: '#333',
      // type: 'arc',
      // curveOffset: 80
    },

    nodeStateStyles: {
      hover: {
        fill: 'lightsteelblue',
      },
      selected: {
        stroke: '#FFF',
        lineWidth: 2,
      },
      selectedFirstDegree: {
        stroke: '#FFF',
        lineWidth: 1,
      },
    },
    edgeStateStyles: {
      selectedFirstDegree: {
        stroke: '#FFF',
      },
    },
  });

  // Mouse enter a node
  graph.on('node:mouseenter', (e) => {
    const nodeItem = e.item; // Get the target item
    graph.setItemState(nodeItem, 'hover', true); // Set the state 'hover' of the item to be true
  });

  // Mouse leave a node
  graph.on('node:mouseleave', (e) => {
    const nodeItem = e.item; // Get the target item
    graph.setItemState(nodeItem, 'hover', false); // Set the state 'hover' of the item to be false
  });

  // Click a node
  graph.on('node:click', (e) => {
    const oldSelected = graph.findAllByState('node', 'selected')
    oldSelected.forEach((cn) => {
      graph.setItemState(cn, 'selected', false);
      cn.getNeighbors().forEach((neighbor) => {
        graph.setItemState(neighbor, 'selectedFirstDegree', false);
      });
      cn.getEdges().forEach((edge) => {
        graph.setItemState(edge, 'selectedFirstDegree', false);
      });
      graph.updateItem(cn, {
        label: ""
      })
    });

    const nodeItem = e.item;
    graph.setItemState(nodeItem, 'selected', true);
    nodeItem.getNeighbors().forEach((neighbor) => {
      graph.setItemState(neighbor, 'selectedFirstDegree', true);
    });
    nodeItem.getEdges().forEach((edge) => {
      graph.setItemState(edge, 'selectedFirstDegree', true);
    });
    graph.updateItem(nodeItem, {
      label: nodeItem.getModel().title
    })

  });

  graph.on('node:dragstart', function (e) {
    graph.layout();
    refreshDragedNodePosition(e);
  });
  graph.on('node:drag', function (e) {
    const forceLayout = graph.get('layoutController').layoutMethod;
    forceLayout.execute();
    refreshDragedNodePosition(e);
  });
  graph.on('node:dragend', function (e) {
    e.item.get('model').fx = null;
    e.item.get('model').fy = null;
  });

  return graph
}



function refreshDragedNodePosition(e) {
  const model = e.item.get('model');
  model.fx = e.x;
  model.fy = e.y;
}

