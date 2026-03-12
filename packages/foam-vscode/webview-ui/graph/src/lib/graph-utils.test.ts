import { describe, it, expect } from 'vitest';
import { augmentGraphInfo } from './graph-utils';
import type { GraphData } from '../protocol';

const makeGraph = (overrides: Partial<GraphData> = {}): GraphData => ({
  nodeInfo: {},
  links: [],
  ...overrides,
});

describe('augmentGraphInfo', () => {
  it('should copy note nodes into the augmented graph', () => {
    const graph = makeGraph({
      nodeInfo: {
        'note-1': { id: 'note-1', type: 'note', title: 'Note 1', properties: {}, tags: [] },
      },
    });
    const augmented = augmentGraphInfo(graph);
    expect(augmented.nodeInfo['note-1']).toBeDefined();
    expect(augmented.nodeInfo['note-1'].type).toBe('note');
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

    const augmented = augmentGraphInfo(graph);

    expect(augmented.nodeInfo['my-tag']).toBeDefined();
    expect(augmented.nodeInfo['my-tag'].type).toBe('tag');
  });

  it('should expose tag type in nodeInfo so filter panel can show it', () => {
    // This documents the fix: _syncNodeTypes must receive the augmented graph,
    // not the raw graph, because tag nodes only exist after augmentation.
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

    const augmented = augmentGraphInfo(graph);
    const augmentedTypes = new Set(Object.values(augmented.nodeInfo).map(n => n.type));
    expect(augmentedTypes.has('tag')).toBe(true); // tag present after augmentation
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

    const augmented = augmentGraphInfo(graph);

    expect(augmented.nodeInfo['parent']).toBeDefined();
    expect(augmented.nodeInfo['parent'].type).toBe('tag');
    expect(augmented.nodeInfo['parent/child']).toBeDefined();
    expect(augmented.nodeInfo['parent/child'].type).toBe('tag');
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

    const augmented = augmentGraphInfo(graph);

    const tagToNoteLink = augmented.links.find(
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

    const augmented = augmentGraphInfo(graph);

    const dupes = augmented.links.filter(
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

    const augmented = augmentGraphInfo(graph);

    expect(augmented.nodeInfo['my-tag'].neighbors).toContain('note-1');
    expect(augmented.nodeInfo['note-1'].neighbors).toContain('my-tag');
  });
});
