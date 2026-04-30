import { describe, it, expect } from 'vitest';
import { createGraphModel, computeGraphStates, getFocusSubset } from './graph-utils';
import { makeGraph } from '../test-utils';
import { GraphModelLink } from './types';

describe('GraphModelLink', () => {
  it('computes the same key for string and object endpoints', () => {
    expect(GraphModelLink.getKey({ source: 'note-1', target: 'note-2' })).toBe(
      'note-1->note-2'
    );
    expect(
      GraphModelLink.getKey({
        source: {
          id: 'note-1',
          type: 'note',
          title: 'Note 1',
          properties: {},
          tags: [],
          neighbors: [],
          links: [],
        },
        target: {
          id: 'note-2',
          type: 'note',
          title: 'Note 2',
          properties: {},
          tags: [],
          neighbors: [],
          links: [],
        },
      })
    ).toBe('note-1->note-2');
  });
});

describe('createGraphModel', () => {
  it('should copy note nodes into the graph model', () => {
    const graph = makeGraph({
      nodeInfo: {
        'note-1': { id: 'note-1', type: 'note', title: 'Note 1', properties: {}, tags: [] },
      },
    });
    const graphModel = createGraphModel(graph);
    expect(graphModel.nodeInfo['note-1']).toBeDefined();
    expect(graphModel.nodeInfo['note-1'].type).toBe('note');
  });

  it('should prefix tag titles with #', () => {
    const graph = makeGraph({
      nodeInfo: {
        'note-1': {
          id: 'note-1', type: 'note', title: 'Note 1', properties: {},
          tags: [{ label: 'my-tag' }, { label: 'parent/child' }],
        },
      },
    });
    const graphModel = createGraphModel(graph);
    expect(graphModel.nodeInfo['my-tag'].title).toBe('#my-tag');
    expect(graphModel.nodeInfo['parent'].title).toBe('#parent');
    expect(graphModel.nodeInfo['parent/child'].title).toBe('#parent/child');
  });

  it('should create tag nodes in nodeInfo for each unique tag', () => {
    const graph = makeGraph({
      nodeInfo: {
        'note-1': {
          id: 'note-1', type: 'note', title: 'Note 1', properties: {},
          tags: [{ label: 'my-tag' }],
        },
      },
    });

    const graphModel = createGraphModel(graph);

    expect(graphModel.nodeInfo['my-tag']).toBeDefined();
    expect(graphModel.nodeInfo['my-tag'].type).toBe('tag');
  });

  it('should expose tag type in nodeInfo so filter panel can show it', () => {
    // This documents the fix: _syncNodeTypes must receive the graph model,
    // not the raw graph, because tag nodes only exist after the model is created.
    const graph = makeGraph({
      nodeInfo: {
        'note-1': {
          id: 'note-1', type: 'note', title: 'Note 1', properties: {},
          tags: [{ label: 'my-tag' }],
        },
      },
    });

    const rawTypes = new Set(Object.values(graph.nodeInfo).map(n => n.type));
    expect(rawTypes.has('tag')).toBe(false); // tag absent in raw data

    const graphModel = createGraphModel(graph);
    const graphModelTypes = new Set(Object.values(graphModel.nodeInfo).map(n => n.type));
    expect(graphModelTypes.has('tag')).toBe(true); // tag present after model creation
  });

  it('should create intermediate nodes for hierarchical tags', () => {
    const graph = makeGraph({
      nodeInfo: {
        'note-1': {
          id: 'note-1', type: 'note', title: 'Note 1', properties: {},
          tags: [{ label: 'parent/child' }],
        },
      },
    });

    const graphModel = createGraphModel(graph);

    expect(graphModel.nodeInfo['parent']).toBeDefined();
    expect(graphModel.nodeInfo['parent'].type).toBe('tag');
    expect(graphModel.nodeInfo['parent/child']).toBeDefined();
    expect(graphModel.nodeInfo['parent/child'].type).toBe('tag');
  });

  it('should create a link from tag to note', () => {
    const graph = makeGraph({
      nodeInfo: {
        'note-1': {
          id: 'note-1', type: 'note', title: 'Note 1', properties: {},
          tags: [{ label: 'my-tag' }],
        },
      },
    });

    const graphModel = createGraphModel(graph);

    const tagToNoteLink = graphModel.links.find(
      l => l.source === 'my-tag' && l.target === 'note-1'
    );
    expect(tagToNoteLink).toBeDefined();
  });

  it('should deduplicate links', () => {
    const graph = makeGraph({
      nodeInfo: {
        'note-1': {
          id: 'note-1', type: 'note', title: 'Note 1', properties: {},
          tags: [{ label: 'my-tag' }],
        },
        'note-2': {
          id: 'note-2', type: 'note', title: 'Note 2', properties: {},
          tags: [{ label: 'my-tag' }],
        },
      },
      links: [{ source: 'note-1', target: 'note-1' }], // duplicate
    });

    const graphModel = createGraphModel(graph);

    const dupes = graphModel.links.filter(
      l => l.source === 'note-1' && l.target === 'note-1'
    );
    expect(dupes.length).toBe(1);
  });

  it('should build neighbor relationships', () => {
    const graph = makeGraph({
      nodeInfo: {
        'note-1': {
          id: 'note-1', type: 'note', title: 'Note 1', properties: {},
          tags: [{ label: 'my-tag' }],
        },
      },
    });

    const graphModel = createGraphModel(graph);

    expect(graphModel.nodeInfo['my-tag'].neighbors).toContain('note-1');
    expect(graphModel.nodeInfo['note-1'].neighbors).toContain('my-tag');
  });
});

describe('computeGraphStates', () => {
  it('should mark all nodes and links as regular when nothing is selected', () => {
    const graph = createGraphModel(makeGraph({
      nodeInfo: {
        'note-1': { id: 'note-1', type: 'note', title: 'Note 1', properties: {}, tags: [] },
        'note-2': { id: 'note-2', type: 'note', title: 'Note 2', properties: {}, tags: [] },
      },
      links: [{ source: 'note-1', target: 'note-2' }],
    }));

    const { nodeStates, linkStates } = computeGraphStates(graph, new Set(), null, 1);

    expect(nodeStates.get('note-1')).toBe('regular');
    expect(nodeStates.get('note-2')).toBe('regular');
    expect(linkStates.get('note-1->note-2')).toBe('regular');
  });

  it('should highlight the selected node and mark unrelated nodes as lessened', () => {
    const graph = createGraphModel(makeGraph({
      nodeInfo: {
        'note-1': { id: 'note-1', type: 'note', title: 'Note 1', properties: {}, tags: [] },
        'note-2': { id: 'note-2', type: 'note', title: 'Note 2', properties: {}, tags: [] },
        'note-3': { id: 'note-3', type: 'note', title: 'Note 3', properties: {}, tags: [] },
      },
      links: [{ source: 'note-1', target: 'note-2' }],
    }));

    const { nodeStates } = computeGraphStates(graph, new Set(['note-1']), null, 1);

    expect(nodeStates.get('note-1')).toBe('highlighted');
    expect(nodeStates.get('note-2')).toBe('regular');  // neighbor
    expect(nodeStates.get('note-3')).toBe('lessened'); // unrelated
  });

  it('should highlight the hovered node the same way as a selected node', () => {
    const graph = createGraphModel(makeGraph({
      nodeInfo: {
        'note-1': { id: 'note-1', type: 'note', title: 'Note 1', properties: {}, tags: [] },
        'note-2': { id: 'note-2', type: 'note', title: 'Note 2', properties: {}, tags: [] },
        'note-3': { id: 'note-3', type: 'note', title: 'Note 3', properties: {}, tags: [] },
      },
      links: [{ source: 'note-1', target: 'note-2' }],
    }));

    const { nodeStates } = computeGraphStates(graph, new Set(), 'note-1', 1);

    expect(nodeStates.get('note-1')).toBe('highlighted');
    expect(nodeStates.get('note-2')).toBe('regular');
    expect(nodeStates.get('note-3')).toBe('lessened');
  });

  it('should use the union of neighborhoods when multiple nodes are selected', () => {
    const graph = createGraphModel(makeGraph({
      nodeInfo: {
        'note-1': { id: 'note-1', type: 'note', title: 'Note 1', properties: {}, tags: [] },
        'note-2': { id: 'note-2', type: 'note', title: 'Note 2', properties: {}, tags: [] },
        'note-3': { id: 'note-3', type: 'note', title: 'Note 3', properties: {}, tags: [] },
        'note-4': { id: 'note-4', type: 'note', title: 'Note 4', properties: {}, tags: [] },
      },
      links: [
        { source: 'note-1', target: 'note-2' },
        { source: 'note-3', target: 'note-4' },
      ],
    }));

    const { nodeStates } = computeGraphStates(graph, new Set(['note-1', 'note-3']), null, 1);

    expect(nodeStates.get('note-1')).toBe('highlighted');
    expect(nodeStates.get('note-2')).toBe('regular');  // neighbor of note-1
    expect(nodeStates.get('note-3')).toBe('highlighted');
    expect(nodeStates.get('note-4')).toBe('regular');  // neighbor of note-3
  });

  it('should highlight only links that touch the selected node', () => {
    // note-1 selected; note-2 and note-3 are both neighbors of note-1
    // link note-1->note-2 touches the origin → highlighted
    // link note-2->note-3 is between two neighbors but not the origin → lessened
    const graph = createGraphModel(makeGraph({
      nodeInfo: {
        'note-1': { id: 'note-1', type: 'note', title: 'Note 1', properties: {}, tags: [] },
        'note-2': { id: 'note-2', type: 'note', title: 'Note 2', properties: {}, tags: [] },
        'note-3': { id: 'note-3', type: 'note', title: 'Note 3', properties: {}, tags: [] },
      },
      links: [
        { source: 'note-1', target: 'note-2' },
        { source: 'note-1', target: 'note-3' },
        { source: 'note-2', target: 'note-3' },
      ],
    }));

    const { linkStates } = computeGraphStates(graph, new Set(['note-1']), null, 1);

    expect(linkStates.get('note-1->note-2')).toBe('highlighted'); // touches origin
    expect(linkStates.get('note-1->note-3')).toBe('highlighted'); // touches origin
    expect(linkStates.get('note-2->note-3')).toBe('lessened');    // between two neighbors, not origin
  });

  it('should expand neighborhood with neighborDepth=2', () => {
    const graph = createGraphModel(makeGraph({
      nodeInfo: {
        'note-1': { id: 'note-1', type: 'note', title: 'Note 1', properties: {}, tags: [] },
        'note-2': { id: 'note-2', type: 'note', title: 'Note 2', properties: {}, tags: [] },
        'note-3': { id: 'note-3', type: 'note', title: 'Note 3', properties: {}, tags: [] },
        'note-4': { id: 'note-4', type: 'note', title: 'Note 4', properties: {}, tags: [] },
      },
      links: [
        { source: 'note-1', target: 'note-2' },
        { source: 'note-2', target: 'note-3' },
      ],
    }));

    const { nodeStates } = computeGraphStates(graph, new Set(['note-1']), null, 2);

    expect(nodeStates.get('note-1')).toBe('highlighted');
    expect(nodeStates.get('note-2')).toBe('regular');  // depth-1 neighbor
    expect(nodeStates.get('note-3')).toBe('regular');  // depth-2 neighbor
    expect(nodeStates.get('note-4')).toBe('lessened'); // unreachable
  });
});

describe('getFocusSubset', () => {
  it('should return the focus node and its depth-1 neighbors', () => {
    const graph = createGraphModel(makeGraph({
      nodeInfo: {
        'note-1': { id: 'note-1', type: 'note', title: 'Note 1', properties: {}, tags: [] },
        'note-2': { id: 'note-2', type: 'note', title: 'Note 2', properties: {}, tags: [] },
        'note-3': { id: 'note-3', type: 'note', title: 'Note 3', properties: {}, tags: [] },
        'note-4': { id: 'note-4', type: 'note', title: 'Note 4', properties: {}, tags: [] },
      },
      links: [
        { source: 'note-1', target: 'note-2' },
        { source: 'note-1', target: 'note-3' },
      ],
    }));

    const subset = getFocusSubset(graph, 'note-1', 1);

    expect(subset.has('note-1')).toBe(true);
    expect(subset.has('note-2')).toBe(true);
    expect(subset.has('note-3')).toBe(true);
    expect(subset.has('note-4')).toBe(false); // disconnected
  });

  it('should return only the focus node itself when it has no neighbors', () => {
    const graph = createGraphModel(makeGraph({
      nodeInfo: {
        'note-1': { id: 'note-1', type: 'note', title: 'Note 1', properties: {}, tags: [] },
        'note-2': { id: 'note-2', type: 'note', title: 'Note 2', properties: {}, tags: [] },
      },
    }));

    const subset = getFocusSubset(graph, 'note-1', 1);

    expect(subset.has('note-1')).toBe(true);
    expect(subset.has('note-2')).toBe(false);
    expect(subset.size).toBe(1);
  });

  it('should expand to depth-2 neighbors when focusDepth=2', () => {
    const graph = createGraphModel(makeGraph({
      nodeInfo: {
        'note-1': { id: 'note-1', type: 'note', title: 'Note 1', properties: {}, tags: [] },
        'note-2': { id: 'note-2', type: 'note', title: 'Note 2', properties: {}, tags: [] },
        'note-3': { id: 'note-3', type: 'note', title: 'Note 3', properties: {}, tags: [] },
        'note-4': { id: 'note-4', type: 'note', title: 'Note 4', properties: {}, tags: [] },
      },
      links: [
        { source: 'note-1', target: 'note-2' },
        { source: 'note-2', target: 'note-3' },
      ],
    }));

    const subset = getFocusSubset(graph, 'note-1', 2);

    expect(subset.has('note-1')).toBe(true);
    expect(subset.has('note-2')).toBe(true);
    expect(subset.has('note-3')).toBe(true);  // depth-2
    expect(subset.has('note-4')).toBe(false); // unreachable
  });
});
