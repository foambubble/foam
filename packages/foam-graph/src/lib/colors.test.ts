import { describe, it, expect } from 'vitest';
import { rgb } from 'd3-color';
import { getTypeColor, getDirectoryColor, getNodeFillAndBorder } from './colors';
import { makeStyle, makeNode, fillOf } from '../test-utils';

// A small graph with nodes of various types and directories
const graph = {
  // Custom types
  projectA: makeNode({ id: '/work/project-a.md',  type: 'project' }),
  projectB: makeNode({ id: '/home/project-b.md',  type: 'project' }),
  personA:  makeNode({ id: '/work/alice.md',       type: 'person'  }),
  personB:  makeNode({ id: '/archive/bob.md',      type: 'person'  }),
  // Built-in types
  noteA:       makeNode({ id: '/work/note-a.md',    type: 'note'        }),
  noteB:       makeNode({ id: '/home/note-b.md',    type: 'note'        }),
  tagNode:     makeNode({ id: '/tag/foo',            type: 'tag'         }),
  placeholder: makeNode({ id: '/work/missing.md',   type: 'placeholder' }),
  // Nodes grouped by directory for directory-mode tests
  workA: makeNode({ id: '/work/a.md', type: 'note'        }),
  workB: makeNode({ id: '/work/b.md', type: 'project'     }),
  homeA: makeNode({ id: '/home/a.md', type: 'note'        }),
};

describe('color by type', () => {
  it('nodes of the same type get the same color', () => {
    expect(fillOf(graph.projectA, 'type')).toBe(fillOf(graph.projectB, 'type'));
    expect(fillOf(graph.personA,  'type')).toBe(fillOf(graph.personB,  'type'));
    expect(fillOf(graph.noteA,    'type')).toBe(fillOf(graph.noteB,    'type'));
  });

  it('nodes of different types get different colors', () => {
    expect(fillOf(graph.projectA, 'type')).not.toBe(fillOf(graph.personA, 'type'));
    expect(fillOf(graph.projectA, 'type')).not.toBe(fillOf(graph.noteA,   'type'));
    expect(fillOf(graph.personA,  'type')).not.toBe(fillOf(graph.noteA,   'type'));
  });

  it('placeholders are styled differently from notes', () => {
    expect(fillOf(graph.placeholder, 'type')).not.toBe(fillOf(graph.noteA, 'type'));
  });

  it('ignores the node directory when coloring by type', () => {
    // workA and homeA are in different directories but both 'note' type
    expect(fillOf(graph.workA, 'type')).toBe(fillOf(graph.homeA, 'type'));
  });
});

describe('color by directory', () => {
  it('nodes in the same directory get the same color', () => {
    // workA (note) and workB (project) share /work/ — should be the same color
    expect(fillOf(graph.workA, 'directory')).toBe(fillOf(graph.workB, 'directory'));
  });

  it('nodes in different directories get different colors', () => {
    expect(fillOf(graph.workA, 'directory')).not.toBe(fillOf(graph.homeA, 'directory'));
  });

  it('ignores the node type when coloring by directory', () => {
    // workA is 'note', workB is 'project' — same dir means same color
    expect(fillOf(graph.workA, 'directory')).toBe(fillOf(graph.workB, 'directory'));
  });

  it('placeholders keep their own color regardless of directory', () => {
    // placeholders have no real location on disk — their "missing note" signal
    // should stay visible even when directory coloring is active
    expect(fillOf(graph.placeholder, 'directory')).not.toBe(fillOf(graph.workA, 'directory'));
  });

  it('tags keep their own color regardless of directory', () => {
    // tags are not file-based, so directory coloring does not apply to them
    expect(fillOf(graph.tagNode, 'directory')).toBe(fillOf(graph.tagNode, 'type'));
  });
});

describe('color by none', () => {
  it('all nodes get the same color regardless of type', () => {
    expect(fillOf(graph.projectA,   'none')).toBe(fillOf(graph.noteA,   'none'));
    expect(fillOf(graph.tagNode,    'none')).toBe(fillOf(graph.noteA,   'none'));
    expect(fillOf(graph.placeholder,'none')).toBe(fillOf(graph.noteA,   'none'));
    expect(fillOf(graph.workA,      'none')).toBe(fillOf(graph.homeA,   'none'));
  });

  it('all nodes get the same color regardless of directory', () => {
    expect(fillOf(graph.workA, 'none')).toBe(fillOf(graph.homeA, 'none'));
  });
});

describe('node properties.color takes precedence over colorMode', () => {
  const redNode = makeNode({ id: '/work/special.md', type: 'project', properties: { color: 'red' } });

  it('overrides type coloring', () => {
    expect(fillOf(redNode, 'type')).not.toBe(fillOf(graph.projectA, 'type'));
    expect(fillOf(redNode, 'type')).toBe(rgb('red').toString());
  });

  it('overrides directory coloring', () => {
    // redNode and workA are both in /work/, but redNode has an explicit color
    expect(fillOf(redNode,      'directory')).not.toBe(fillOf(graph.workA, 'directory'));
    expect(fillOf(redNode, 'directory')).toBe(rgb('red').toString());
  });

  it('overrides none coloring', () => {
    expect(fillOf(redNode, 'none')).toBe(rgb('red').toString());
  });
});

describe('group color overrides colorMode', () => {
  const makeGroup = (color: string, type: string) => ({
    id: 'g1', label: 'test', color, enabled: true,
    match: { property: 'type' as const, value: type },
  });

  it('an enabled matching group overrides type color', () => {
    const group = makeGroup('#ff0000', 'project');
    const style = makeStyle();
    const result = getNodeFillAndBorder(graph.projectA, 'regular', style, 'type', [group]);
    expect(result.fill.toString()).toBe(rgb('#ff0000').toString());
  });

  it('an enabled matching group overrides directory color', () => {
    const group = makeGroup('#ff0000', 'note');
    const style = makeStyle();
    const result = getNodeFillAndBorder(graph.workA, 'regular', style, 'directory', [group]);
    expect(result.fill.toString()).toBe(rgb('#ff0000').toString());
  });

  it('a disabled group does not override color', () => {
    const group = { ...makeGroup('#ff0000', 'project'), enabled: false };
    const style = makeStyle();
    const result = getNodeFillAndBorder(graph.projectA, 'regular', style, 'type', [group]);
    expect(result.fill.toString()).not.toBe(rgb('#ff0000').toString());
  });

  it('last matching group wins when multiple groups match', () => {
    const style = makeStyle();
    const groups = [
      makeGroup('#ff0000', 'project'),
      makeGroup('#00ff00', 'project'),
    ];
    const result = getNodeFillAndBorder(graph.projectA, 'regular', style, 'type', groups);
    expect(result.fill.toString()).toBe(rgb('#00ff00').toString());
  });
});

describe('color generation', () => {
  it('getTypeColor returns a parseable CSS color for unknown types', () => {
    const style = makeStyle();
    expect(rgb(getTypeColor('some-unknown-type', style)).displayable()).toBe(true);
  });

  it('getDirectoryColor returns a parseable CSS color', () => {
    expect(rgb(getDirectoryColor('/any/path/note.md')).displayable()).toBe(true);
  });

  it('getTypeColor is deterministic', () => {
    const style = makeStyle();
    expect(getTypeColor('project', style)).toBe(getTypeColor('project', style));
  });

  it('getDirectoryColor is deterministic', () => {
    expect(getDirectoryColor('/work/note.md')).toBe(getDirectoryColor('/work/note.md'));
  });
});
