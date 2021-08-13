const CONTAINER_ID = 'graph';

const coseLayout = {
  name: 'cose',
  idealEdgeLength: 50,
  nodeOverlap: 20,
  refresh: 20,
  fit: false,
  padding: 30,
  randomize: false,
  componentSpacing: 100,
  //nodeRepulsion: 400000,
  nodeRepulsion: function(node) {return node.data('type') == "folder" ? 100000*graph.nodes().maxDegree() : 100000*node.degree(); },
  edgeElasticity: 100,
  nestingFactor: 5,
  gravity: 80,
  numIter: 1000,
  initialTemp: 200,
  coolingFactor: 0.95,
  minTemp: 1.0,
  animate: false
};
var fcoseLayout = {
  name: "fcose",
  quality: "default",
  randomize: true, 
  animate: false, 
  nodeDimensionsIncludeLabels: true,
  uniformNodeDimensions: true,
  nodeRepulsion: node => 4500,
  idealEdgeLength: edge => 100,
};
var fcose = {
  name: "fcose",
  quality: "default",
  randomize: true, 
  animate: false, 
  nodeDimensionsIncludeLabels: true,
  uniformNodeDimensions: true,
  nodeRepulsion: node => 4500,
  idealEdgeLength: edge => 100,
};
let hierarchyLayout = {
  name: 'breadthfirst',

  fit: true, // whether to fit the viewport to the graph
  directed: true, // whether the tree is directed downwards (or edges can point in any direction if false)
  padding: 30, // padding on fit
  circle: false, // put depths in concentric circles if true, put depths top down if false
  grid: false, // whether to create an even grid into which the DAG is placed (circle:false only)
  spacingFactor: 300, // positive spacing factor, larger => more space between nodes (N.B. n/a if causes overlap)
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
  nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm,
  animate: false
};
const preHierarchyLayout = {
  name: 'preset',
  positions: node => positions.get(node.id()), // map of (node id) => (position obj); or function(node){ return somPos; }
};

const defaultStyle = [{
  "selector": "core",
  "style": {
    "selection-box-color": "#AAD8FF",
    "selection-box-border-color": "#8BB0D0",
    "selection-box-opacity": "0.5"
  }
}, {
  "selector": "node",
  "style": {
    "width": "20",
    "height": "20",
    "content": "data(title)",
    "min-zoomed-font-size": "18",
    "font-size": "12px",
    "text-valign": "bottom",
    "text-halign": "center",
    "background-color": "#555",
    "text-outline-color": "#555",
    "text-outline-width": "2px",
    "color": "#fff",
    "overlay-padding": "6px",
    "z-index": "10"
  }
}, {
  "selector": "node[type = 'note']",
  "style": {
    "background-color": "blue",
  }
}, {
  "selector": "node[type = 'folder']",
  "style": {
    "shape": "rectangle",
    "width": "40",
    "height": "20",
    "background-color": "cyan",
  }
}, {
  "selector": "node[type = 'tag']",
  "style": {
    "text-valign": "center",
    "background-opacity": "0",
    "background-color": "red",
    "text-outline-width": "1px",
    "color": "data(tagColor)",
  }
}, {
  "selector": "node[type = 'placeholder']",
  "style": {
    "background-color": "yellow",
  }
}, {
  "selector": "node:selected",
  "style": {
    "border-width": "6px",
    "border-color": "#AAD8FF",
    "border-opacity": "0.5",
    "background-color": "#77828C",
    "text-outline-color": "#77828C"
  }
}, {
  "selector": "node[type = 'tag']:selected",
  "style": {
    "text-valign": "center",
    "border-width": "0px",
    "background-opacity": "0",
    "background-color": "red",
    "text-outline-width": "1px",
    "color": "data(tagColor)",
  }
}, {
  "selector": "edge",
  "style": {
    "curve-style": "haystack",
    "haystack-radius": "0",
    "opacity": "0.1",
    "line-color": "#bbb",
    "width": "2",
    "overlay-padding": "3px"
  }
}, {
  "selector": "node.unhighlighted",
  "style": {
    "opacity": "0.2"
  }
}, {
  "selector": "edge.unhighlighted",
  "style": {
    "opacity": "0.05"
  }
}, {
  "selector": "edge.highlighted",
  "style": {
    "opacity": "0.4",
    "line-color": "orange"
  }
}, {
  "selector": "edge.outgoing",
  "style": {
    "opacity": "0.6",
    "line-color": "blue"
  }
}, {
  "selector": "edge.incoming",
  "style": {
    "opacity": "0.6",
    "line-color": "orange"
  }
}, {
  "selector": ".highlighted",
  "style": {
    "z-index": "999999"
  }
}, {
  "selector": "node.highlighted",
  "style": {
    "border-width": "6px",
    "border-color": "orange",
    "border-opacity": "0.9",
    "background-color": "#394855",
    "text-outline-color": "#394855"
  }
}, {
  "selector": "node.tagged",
  "style": {
    "border-width": "6px",
    "border-opacity": "0.8",
    "background-color": "#394855",
    "border-color": "data(tagColor)",
    "text-outline-color": "#394855"
  }
}, {
  "selector": "node[type = 'tag'].tagged",
  "style": {
    "text-valign": "center",
    "border-width": "0px",
    "background-opacity": "0",
    "background-color": "red",
    "text-outline-width": "1px",
    "color": "data(tagColor)",
  }
}, {
  "selector": "edge.tagged",
  "style": {
    "line-color": "data(tagColor)",
    "opacity": "0.8"
  }
}, {
  "selector": "edge[type = 'tag']:selected",
  "style": {
    "line-color": "data(tagColor)",
    "opacity": "0.8"
  }
}, {
  "selector": "edge.filtered",
  "style": {
    "opacity": "0"
  }
}];
const propStyles = [
  {
    "selector": "node[?color]",
    "style": {
      "background-color": "data(color)",
    }
  }
];

var graph;
var graphInfo;

const filters = {
  allEdges: () =>{
    return graph.edges();
  },
  edgeByType: (collection,types) => {
    return collection.edges('[type]').filter(n => {
      return types.some(t => n.data('type')==t);
    });
  },
  nodeByType: (collection,types) => {
    return collection.nodes('[type]').filter(n => {
      return types.some(t => n.data('type')==t);
    });
  },
  byTags: () => {
    return filters.nodeByType(graph,["tag"]).closedNeighborhood();
  },
  bySelection: () => {
    return graph.nodes().filter(n => n.selected());
  }
};
function defaultFilter() {
  return filters.nodeByType(graph,["note","placeholder","folder"]).union(filters.allEdges());
};
function hierarchyFilter() {
  return filters.nodeByType(graph,["note","folder"]).union(filters.edgeByType(graph,["folder"]));
}
function withTagsFilter() {
  return filters.nodeByType(graph,["note","placeholder","tag"]).union(filters.allEdges());
};
function taggedFilter() {
  return filters.byTags();
}
const views = new Map([
  ["default",defaultFilter],
  ["hierarchy",hierarchyFilter],
  ["withTags",withTagsFilter],
  ["tagged",taggedFilter]
]);
function applyFilter(filter) {
  graph.elements().difference(filter).remove();
}
const model = {
  View: "default",
  SearchText: "",
  SearchResults: [],
  HighlightTags: false,
  LimitSelection: false,
};
const clear = () => {
    let selection = filters.bySelection();
    graph.json(graphInfo);
    selection.select();
  };
const apply = () => {
    let filter = views.get(model.View)();
    applyFilter(filter);
  };
const select = () => {
    if(model.LimitSelection){
      let selection = filters.bySelection().closedNeighborhood();
      if(selection.nonempty()) applyFilter(selection);
    }
  };
const highlight = () => {
    if(model.SearchText){
      let highlighter = graph.collection();
      model.SearchResults.forEach(r => highlighter = highlighter.union(graph.getElementById(r)));
      highlighter = highlighter.union(filters.allEdges().filter(e => highlighter.contains(e.connectedNodes())));
      highlighter.toggleClass("highlighted");
      graph.elements().difference(highlighter).toggleClass("unhighlighted",true);
    }
  };
const highlightTags = () => {
    if(model.HighlightTags){
      let tagged = filters.byTags();
      tagged.toggleClass('tagged');
      graph.elements().difference(tagged).toggleClass('unhighlighted',true);
    }
  };
const run = () => {
    if(model.View == "hierarchy"){
      graph.layout(fcoseLayout).run();
    } else {
      graph.layout(coseLayout).run();
    }
  };

const evaluateModel = () => {
  graph.startBatch();
    clear();
    select();
    apply();
    highlight();
    highlightTags();
    run();
  graph.endBatch();
};
function updateStyle(newStyle) {
  if (!newStyle) {
    return;
  }
  let styleUpdate = [...defaultStyle, ...newStyle.styles, ...propStyles];
  graph.style(styleUpdate).update();
}
function initDataviz(channel) {
  const elem = document.getElementById(CONTAINER_ID);
  graph = cytoscape({
    container: elem,
    style: [...defaultStyle, ...propStyles],
    wheelSensitivity: 0.2,
    pixelRatio: 1,
    hideEdgesOnViewport: true,
    textureOnViewport: true,
  });
  const gui = new dat.gui.GUI();
    gui.add(model, 'View', {Default: "default", Hierarchy: "hierarchy", WithTags: "withTags", Tagged: "tagged"})
      .onFinishChange(function(){
        evaluateModel();
      });
    gui.add(model, "SearchText")
      .onFinishChange(function(){
        if(model.SearchText) {
          channel.postMessage({
            type: 'webviewDidSubmitSearch',
            payload: model.SearchText,
          });
        }
        evaluateModel();
      });
    gui.add(model, "HighlightTags")
      .onChange(function(){
        evaluateModel();
      });
    gui.add(model, "LimitSelection")
      .onChange(function(){
        evaluateModel();
      });
  
  graph.on('select', e => {
    let node = e.target;
    if(node.data('type') == "note") {
      node.outgoers().edges().toggleClass("outgoing", true);
      node.incomers().edges().forEach(e => {
        e.data('type') == "tag" ? e.select() : e.toggleClass("incoming", true);
      });
    }
    if(node.data('type') == "tag") {
      node.connectedEdges().select();
    }
    channel.postMessage({
      type: 'webviewDidSelectNode',
      payload: node.id(),
    });
  });
  graph.on('unselect', e => {
    let node = e.target;
    if(node.data('type') == "note") {
      node.outgoers().edges().toggleClass("outgoing", false);
      node.incomers().edges().forEach(e => {
        e.data('type') == "tag" ? e.unselect() : e.toggleClass("incoming", false);
      });
    }
    if(node.data('type') == "tag") {
      node.connectedEdges().unselect();
    }
  });
}

function augmentData() {
  let cy = cytoscape({layout: {name: "random"}});
  Object.keys(graphInfo.nodes).forEach(n => {
    let nData = graphInfo.nodes[n];
    cy.add({group: 'nodes', data: nData});
    if(nData.type == "note") {
      if(nData.properties.color) cy.$id(nData.id).data('color', nData.properties.color);
      if(nData.tags.length > 0) {
        let tags = cy.nodes('[type = "tag"]');
        nData.tags.forEach(tag => {
          let tagNode = tags.filter(t => t.data('title') == tag.label);
          if(tagNode.empty()) {
            tagNode = cy.add({group: 'nodes', data: {type: 'tag', title: tag.label}});
          }
          cy.add({group: 'edges', data: {target: nData.id, source: tagNode.id(), type: 'tag'}});
        });
      }
      let folders = nData.id.split('/');
      folders = folders.slice(folders.indexOf(graphInfo.rootFolder),folders.length-1);
      let parent;
      folders.forEach(f => {
        if (f == graphInfo.rootFolder) {
          f = 'root';
        }
        let node = cy.nodes('[type = "folder"]').filter(folder => {
          return folder.data('title') == f;
        });
        if (node.empty()) {
          node = cy.add({ group: 'nodes', data: { title: f, type: 'folder' } });
          if (parent) {
            cy.add({
              group: 'edges',
              data: { source: parent.id(), target: node.id(), type: 'folder' },
            });
          }
        }
        parent = node;
      });
      cy.add({
        group: 'edges',
        data: { source: parent.id(), target: nData.id, type: 'folder' },
      });
    }
  });
  graphInfo.links.forEach(e => {
    cy.add({group: 'edges', data: e});
  });
  let tags = cy.nodes('[type = "tag"]');
  tags.forEach(t => {
    let tagged = t.closedNeighborhood();
    let color = d3.interpolateTurbo(Math.random());
    tagged.data('tagColor',color);
  });
  graphInfo = cy.json();
  let folders = cy.elements('[type = "folder"]');
  folders.layout(hierarchyLayout).run();
  fcoseLayout.fixedNodeConstraint = folders.nodes().map(n => {
    return {nodeId: n.id(), position: n.position()};
  });
  cy.destroy();
}

// init the app
try {
  const vscode = acquireVsCodeApi();

  window.onload = () => {
    initDataviz(vscode);
    console.log('ready');
    vscode.postMessage({
      type: 'webviewDidLoad',
    });
  };

  window.addEventListener('error', error => {
    vscode.postMessage({
      type: 'error',
      payload: {
        message: error.message,
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
        error: error.error,
      },
    });
  });

  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
      case 'didUpdateGraphData':
        console.log('didUpdateGraphData', message.payload);
        graphInfo = message.payload;
        augmentData();
        graph.json(graphInfo);
        evaluateModel();
        break;
      case 'didSelectNote':
        const noteId = message.payload;
        const node = graph.getElementById(noteId);
        if (node) {
          graph.center(node);
          node.flashClass('highlighted',1000);
        }
        break;
      case 'didUpdateStyle':
        const style = message.payload;
        updateStyle(style);
        break;
      case 'didReturnSearchResults':
        model.SearchResults = message.payload;
        evaluateModel();
        break;
    }
  });
} catch {
  console.log('VsCode not detected');
}

window.addEventListener('resize', () => {
  graph.width(window.innerWidth).height(window.innerHeight);
});

// For testing
/*if (window.data) {
  console.log('Test mode');
  window.model = model;
  window.graph = graph;
  window.onload = () => {
    initDataviz({
      postMessage: message => console.log('message', message),
    });
    const graphData = augmentGraphInfo(window.data);
    Actions.refresh(graphData);
  };
}*/