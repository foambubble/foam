import { Logger } from '../utils/log';
import { FoamGraph } from '../model/graph';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { executeQuery, parseFilter, QueryDescriptor } from '.';

Logger.setLevel('error');

// Helper: build a workspace + graph from a list of notes.
// Notes are added in order — links are resolved against whatever is in the workspace.
function makeWorkspaceAndGraph(notes: ReturnType<typeof createTestNote>[]) {
  const workspace = createTestWorkspace();
  notes.forEach(n => workspace.set(n));
  const graph = FoamGraph.fromWorkspace(workspace, false);
  return { workspace, graph };
}

// ─── parseFilter ─────────────────────────────────────────────────────────────

describe('parseFilter — shorthand strings', () => {
  it('undefined filter matches all resources', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const pred = parseFilter(undefined, workspace, graph, false);
    expect(pred(workspace.list()[0])).toBe(true);
  });

  it('"*" matches all resources', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const pred = parseFilter('*', workspace, graph, false);
    expect(pred(workspace.list()[0])).toBe(true);
  });

  it('"#tag" matches notes with that tag, not others', () => {
    const noteA = createTestNote({ uri: '/a.md', tags: ['research'] });
    const noteB = createTestNote({ uri: '/b.md', tags: ['other'] });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const pred = parseFilter('#research', workspace, graph, false);
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
  });

  it('"[[note]]" matches notes that link to it or that it links to', () => {
    const noteA = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] }); // noteA → noteB
    const noteB = createTestNote({ uri: '/b.md', links: [{ slug: 'c' }] }); // noteB → noteC
    const noteC = createTestNote({ uri: '/c.md' });
    const noteD = createTestNote({ uri: '/d.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([
      noteA,
      noteB,
      noteC,
      noteD,
    ]);

    const pred = parseFilter('[[b]]', workspace, graph, false);
    expect(pred(noteA)).toBe(true); // noteA links TO noteB
    expect(pred(noteB)).toBe(false); // noteB is the reference node, not a neighbor
    expect(pred(noteC)).toBe(true); // noteC is linked FROM noteB (outlink of noteB)
    expect(pred(noteD)).toBe(false); // noteD has no connection to noteB
  });

  it('"[[note]]" returns false for all when the identifier is not found', () => {
    const noteA = createTestNote({ uri: '/a.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const pred = parseFilter('[[nonexistent]]', workspace, graph, false);
    expect(pred(noteA)).toBe(false);
  });

  it('"/regex/" matches notes whose path matches the regex', () => {
    const noteA = createTestNote({ uri: '/projects/work.md' });
    const noteB = createTestNote({ uri: '/journal/today.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const pred = parseFilter('/projects/', workspace, graph, false);
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
  });
});

describe('parseFilter — structured keys', () => {
  it('tag filter matches notes with that tag (with or without #)', () => {
    const noteA = createTestNote({ uri: '/a.md', tags: ['research'] });
    const noteB = createTestNote({ uri: '/b.md', tags: ['other'] });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const predWithHash = parseFilter(
      { tag: '#research' },
      workspace,
      graph,
      false
    );
    const predWithout = parseFilter(
      { tag: 'research' },
      workspace,
      graph,
      false
    );

    expect(predWithHash(noteA)).toBe(true);
    expect(predWithHash(noteB)).toBe(false);
    expect(predWithout(noteA)).toBe(true);
    expect(predWithout(noteB)).toBe(false);
  });

  it('type filter matches notes of that type only', () => {
    const noteA = createTestNote({ uri: '/a.md', type: 'daily-note' });
    const noteB = createTestNote({ uri: '/b.md', type: 'note' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const pred = parseFilter({ type: 'daily-note' }, workspace, graph, false);
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
  });

  it('path filter matches notes whose path satisfies the regex', () => {
    const noteA = createTestNote({ uri: '/archive/old.md' });
    const noteB = createTestNote({ uri: '/notes/current.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const pred = parseFilter({ path: '^/archive' }, workspace, graph, false);
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
  });

  it('title filter matches notes whose title satisfies the regex', () => {
    const noteA = createTestNote({ uri: '/a.md', title: 'Meeting notes' });
    const noteB = createTestNote({ uri: '/b.md', title: 'Project plan' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const pred = parseFilter({ title: '^Meeting' }, workspace, graph, false);
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
  });

  it('links_to filter matches notes that have an outbound link to the identifier', () => {
    const noteA = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] });
    const noteB = createTestNote({ uri: '/b.md' });
    const noteC = createTestNote({ uri: '/c.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB, noteC]);

    const pred = parseFilter({ links_to: 'b' }, workspace, graph, false);
    expect(pred(noteA)).toBe(true); // noteA links to noteB
    expect(pred(noteB)).toBe(false); // noteB doesn't link to noteB
    expect(pred(noteC)).toBe(false); // noteC doesn't link to noteB
  });

  it('links_from filter matches notes that are linked from the identifier', () => {
    const noteA = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] });
    const noteB = createTestNote({ uri: '/b.md' });
    const noteC = createTestNote({ uri: '/c.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB, noteC]);

    const pred = parseFilter({ links_from: 'a' }, workspace, graph, false);
    expect(pred(noteA)).toBe(false); // noteA is the source, not the target
    expect(pred(noteB)).toBe(true); // noteB is linked from noteA
    expect(pred(noteC)).toBe(false); // noteC is not linked from noteA
  });

  it('links_to returns false for all when identifier is not found', () => {
    const noteA = createTestNote({ uri: '/a.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const pred = parseFilter(
      { links_to: 'nonexistent' },
      workspace,
      graph,
      false
    );
    expect(pred(noteA)).toBe(false);
  });

  it('links_from returns false for all when identifier is not found', () => {
    const noteA = createTestNote({ uri: '/a.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const pred = parseFilter(
      { links_from: 'nonexistent' },
      workspace,
      graph,
      false
    );
    expect(pred(noteA)).toBe(false);
  });
});

describe('parseFilter — logical operators', () => {
  it('and requires all sub-filters to match', () => {
    const noteA = createTestNote({
      uri: '/a.md',
      tags: ['research'],
      type: 'note',
    });
    const noteB = createTestNote({
      uri: '/b.md',
      tags: ['research'],
      type: 'daily-note',
    });
    const noteC = createTestNote({
      uri: '/c.md',
      tags: ['other'],
      type: 'note',
    });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB, noteC]);

    const pred = parseFilter(
      { and: [{ tag: 'research' }, { type: 'note' }] },
      workspace,
      graph,
      false
    );
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
    expect(pred(noteC)).toBe(false);
  });

  it('or requires at least one sub-filter to match', () => {
    const noteA = createTestNote({ uri: '/a.md', type: 'daily-note' });
    const noteB = createTestNote({ uri: '/b.md', type: 'weekly-note' });
    const noteC = createTestNote({ uri: '/c.md', type: 'note' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB, noteC]);

    const pred = parseFilter(
      { or: [{ type: 'daily-note' }, { type: 'weekly-note' }] },
      workspace,
      graph,
      false
    );
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(true);
    expect(pred(noteC)).toBe(false);
  });

  it('not inverts the sub-filter', () => {
    const noteA = createTestNote({ uri: '/a.md', type: 'daily-note' });
    const noteB = createTestNote({ uri: '/b.md', type: 'note' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const pred = parseFilter(
      { not: { type: 'daily-note' } },
      workspace,
      graph,
      false
    );
    expect(pred(noteA)).toBe(false);
    expect(pred(noteB)).toBe(true);
  });

  it('nested operators: and with not', () => {
    const noteA = createTestNote({ uri: '/a.md', tags: ['research', 'draft'] });
    const noteB = createTestNote({ uri: '/b.md', tags: ['research'] });
    const noteC = createTestNote({ uri: '/c.md', tags: ['draft'] });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB, noteC]);

    const pred = parseFilter(
      { and: [{ tag: 'research' }, { not: { tag: 'draft' } }] },
      workspace,
      graph,
      false
    );
    expect(pred(noteA)).toBe(false); // has research but also draft
    expect(pred(noteB)).toBe(true); // has research, no draft
    expect(pred(noteC)).toBe(false); // no research
  });
});

describe('parseFilter — expression', () => {
  it('expression is skipped (all pass) when workspace is not trusted', () => {
    const noteA = createTestNote({ uri: '/a.md', type: 'type-1' });
    const noteB = createTestNote({ uri: '/b.md', type: 'type-2' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const pred = parseFilter(
      { expression: 'resource.type === "type-1"' },
      workspace,
      graph,
      false
    );
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(true);
  });

  it('expression is evaluated when workspace is trusted', () => {
    const noteA = createTestNote({ uri: '/a.md', type: 'type-1' });
    const noteB = createTestNote({ uri: '/b.md', type: 'type-2' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const pred = parseFilter(
      { expression: 'resource.type === "type-1"' },
      workspace,
      graph,
      true
    );
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
  });

  it('expression can access graph-derived backlinks', () => {
    const noteA = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] });
    const noteB = createTestNote({ uri: '/b.md' });
    const noteC = createTestNote({ uri: '/c.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB, noteC]);

    const pred = parseFilter(
      { expression: 'resource.backlinks.length > 0' },
      workspace,
      graph,
      true
    );
    expect(pred(noteA)).toBe(false); // noteA has no backlinks
    expect(pred(noteB)).toBe(true); // noteB is linked from noteA
    expect(pred(noteC)).toBe(false);
  });

  it('expression runtime error excludes the resource and does not throw', () => {
    const noteA = createTestNote({ uri: '/a.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const pred = parseFilter(
      { expression: 'throw new Error("boom")' },
      workspace,
      graph,
      true
    );
    expect(pred(noteA)).toBe(false);
  });
});

// ─── executeQuery ─────────────────────────────────────────────────────────────

describe('executeQuery — projection', () => {
  it('returns only the selected fields', () => {
    const noteA = createTestNote({
      uri: '/a.md',
      title: 'Alpha',
      tags: ['t1'],
    });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const results = executeQuery(
      { select: ['title', 'tags'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ title: 'Alpha', tags: ['t1'] });
    expect(results[0]).not.toHaveProperty('path');
  });

  it('defaults to [title, path] when select is omitted', () => {
    const noteA = createTestNote({ uri: '/a.md', title: 'Alpha' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const [result] = executeQuery({}, workspace, graph, { trusted: false });
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('path');
    expect(Object.keys(result)).toHaveLength(2);
  });

  it('computed field backlink-count reflects graph state', () => {
    const noteA = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] });
    const noteB = createTestNote({ uri: '/b.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const results = executeQuery(
      { filter: { path: '/b.md' }, select: ['title', 'backlink-count'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(results[0]['backlink-count']).toBe(1);
  });

  it('computed field outlink-count reflects graph state', () => {
    const noteA = createTestNote({
      uri: '/a.md',
      links: [{ slug: 'b' }, { slug: 'c' }],
    });
    const noteB = createTestNote({ uri: '/b.md' });
    const noteC = createTestNote({ uri: '/c.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB, noteC]);

    const results = executeQuery(
      { filter: { path: '/a.md' }, select: ['title', 'outlink-count'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(results[0]['outlink-count']).toBe(2);
  });

  it('unknown field in select is included as undefined', () => {
    const noteA = createTestNote({ uri: '/a.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const [result] = executeQuery(
      { select: ['title', 'nonexistent'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(result).toHaveProperty('nonexistent', undefined);
  });
});

describe('executeQuery — sorting', () => {
  it('sorts by string field ascending by default', () => {
    const notes = [
      createTestNote({ uri: '/c.md', title: 'Gamma' }),
      createTestNote({ uri: '/a.md', title: 'Alpha' }),
      createTestNote({ uri: '/b.md', title: 'Beta' }),
    ];
    const { workspace, graph } = makeWorkspaceAndGraph(notes);

    const results = executeQuery(
      { sort: 'title', select: ['title'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(results.map(r => r.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('sorts by string field descending', () => {
    const notes = [
      createTestNote({ uri: '/a.md', title: 'Alpha' }),
      createTestNote({ uri: '/b.md', title: 'Beta' }),
      createTestNote({ uri: '/c.md', title: 'Gamma' }),
    ];
    const { workspace, graph } = makeWorkspaceAndGraph(notes);

    const results = executeQuery(
      { sort: 'title DESC', select: ['title'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(results.map(r => r.title)).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('unknown sort field preserves stable order', () => {
    const notes = [
      createTestNote({ uri: '/a.md', title: 'Alpha' }),
      createTestNote({ uri: '/b.md', title: 'Beta' }),
    ];
    const { workspace, graph } = makeWorkspaceAndGraph(notes);

    const baseline = executeQuery({ select: ['title'] }, workspace, graph, {
      trusted: false,
    });
    const sorted = executeQuery(
      { sort: 'nonexistent', select: ['title'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(sorted.map(r => r.title)).toEqual(baseline.map(r => r.title));
  });
});

describe('executeQuery — pagination', () => {
  const notes = [
    createTestNote({ uri: '/a.md', title: 'A' }),
    createTestNote({ uri: '/b.md', title: 'B' }),
    createTestNote({ uri: '/c.md', title: 'C' }),
    createTestNote({ uri: '/d.md', title: 'D' }),
  ];

  it('limit returns at most N results', () => {
    const { workspace, graph } = makeWorkspaceAndGraph(notes);
    const results = executeQuery(
      { sort: 'title', limit: 2, select: ['title'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(results).toHaveLength(2);
    expect(results.map(r => r.title)).toEqual(['A', 'B']);
  });

  it('offset skips the first N results', () => {
    const { workspace, graph } = makeWorkspaceAndGraph(notes);
    const results = executeQuery(
      { sort: 'title', offset: 2, select: ['title'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(results.map(r => r.title)).toEqual(['C', 'D']);
  });

  it('limit and offset together', () => {
    const { workspace, graph } = makeWorkspaceAndGraph(notes);
    const results = executeQuery(
      { sort: 'title', offset: 1, limit: 2, select: ['title'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(results.map(r => r.title)).toEqual(['B', 'C']);
  });

  it('limit larger than result count returns all results', () => {
    const { workspace, graph } = makeWorkspaceAndGraph(notes);
    const results = executeQuery(
      { limit: 100, select: ['title'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(results).toHaveLength(4);
  });
});

describe('executeQuery — end to end', () => {
  it('returns empty array for an empty workspace', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([]);
    const results = executeQuery({}, workspace, graph, { trusted: false });
    expect(results).toEqual([]);
  });

  it('returns empty array when no notes match the filter', () => {
    const noteA = createTestNote({ uri: '/a.md', type: 'note' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const results = executeQuery(
      { filter: { type: 'daily-note' } },
      workspace,
      graph,
      { trusted: false }
    );
    expect(results).toEqual([]);
  });

  it('applies filter + select + sort + limit together', () => {
    const notes = [
      createTestNote({ uri: '/a.md', title: 'Alpha', tags: ['research'] }),
      createTestNote({ uri: '/b.md', title: 'Beta', tags: ['research'] }),
      createTestNote({ uri: '/c.md', title: 'Gamma', tags: ['research'] }),
      createTestNote({ uri: '/d.md', title: 'Delta', tags: ['other'] }),
    ];
    const { workspace, graph } = makeWorkspaceAndGraph(notes);

    const query: QueryDescriptor = {
      filter: { tag: 'research' },
      select: ['title'],
      sort: 'title DESC',
      limit: 2,
    };
    const results = executeQuery(query, workspace, graph, { trusted: false });
    expect(results).toHaveLength(2);
    expect(results.map(r => r.title)).toEqual(['Gamma', 'Beta']);
  });
});
