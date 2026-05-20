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
    const { predicate: pred } = parseFilter(undefined, workspace, graph, false);
    expect(pred(workspace.list()[0])).toBe(true);
  });

  it('"*" matches all resources', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const { predicate: pred } = parseFilter('*', workspace, graph, false);
    expect(pred(workspace.list()[0])).toBe(true);
  });

  it('"#tag" matches notes with that tag, not others', () => {
    const noteA = createTestNote({ uri: '/a.md', tags: ['research'] });
    const noteB = createTestNote({ uri: '/b.md', tags: ['other'] });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const { predicate: pred } = parseFilter('#research', workspace, graph, false);
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

    const { predicate: pred } = parseFilter('[[b]]', workspace, graph, false);
    expect(pred(noteA)).toBe(true); // noteA links TO noteB
    expect(pred(noteB)).toBe(false); // noteB is the reference node, not a neighbor
    expect(pred(noteC)).toBe(true); // noteC is linked FROM noteB (outlink of noteB)
    expect(pred(noteD)).toBe(false); // noteD has no connection to noteB
  });

  it('"[[note]]" returns false for all when the identifier is not found', () => {
    const noteA = createTestNote({ uri: '/a.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const { predicate: pred } = parseFilter('[[nonexistent]]', workspace, graph, false);
    expect(pred(noteA)).toBe(false);
  });

  it('"/regex/" matches notes whose path matches the regex', () => {
    const noteA = createTestNote({ uri: '/projects/work.md' });
    const noteB = createTestNote({ uri: '/journal/today.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const { predicate: pred } = parseFilter('/projects/', workspace, graph, false);
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
  });
});

describe('parseFilter — structured keys', () => {
  it('tag filter matches notes with that tag (with or without #)', () => {
    const noteA = createTestNote({ uri: '/a.md', tags: ['research'] });
    const noteB = createTestNote({ uri: '/b.md', tags: ['other'] });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const { predicate: predWithHash } = parseFilter(
      { tag: '#research' },
      workspace,
      graph,
      false
    );
    const { predicate: predWithout } = parseFilter(
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

    const { predicate: pred } = parseFilter({ type: 'daily-note' }, workspace, graph, false);
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
  });

  it('path filter matches notes whose path satisfies the regex', () => {
    const noteA = createTestNote({ uri: '/archive/old.md' });
    const noteB = createTestNote({ uri: '/notes/current.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const { predicate: pred } = parseFilter({ path: '^/archive' }, workspace, graph, false);
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
  });

  it('title filter matches notes whose title satisfies the regex', () => {
    const noteA = createTestNote({ uri: '/a.md', title: 'Meeting notes' });
    const noteB = createTestNote({ uri: '/b.md', title: 'Project plan' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const { predicate: pred } = parseFilter({ title: '^Meeting' }, workspace, graph, false);
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
  });

  it('path filter rejects catastrophically backtracking regexes and matches nothing', () => {
    // Note path ends in `a`, so `(a+)+$` *would* match if executed —
    // a `false` result proves the regex was rejected before evaluation.
    const noteA = createTestNote({ uri: '/aaa' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const { predicate: pred } = parseFilter({ path: '(a+)+$' }, workspace, graph, false);
    expect(pred(noteA)).toBe(false);
  });

  it('title filter rejects catastrophically backtracking regexes and matches nothing', () => {
    const noteA = createTestNote({ uri: '/a.md', title: 'aaaa' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const { predicate: pred } = parseFilter({ title: '(a+)+$' }, workspace, graph, false);
    expect(pred(noteA)).toBe(false);
  });

  it('"/regex/" shorthand rejects catastrophically backtracking regexes and matches nothing', () => {
    const noteA = createTestNote({ uri: '/aaa' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const { predicate: pred } = parseFilter('/(a+)+$/', workspace, graph, false);
    expect(pred(noteA)).toBe(false);
  });

  it('path filter rejects invalid regex syntax and matches nothing', () => {
    const noteA = createTestNote({ uri: '/a.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const { predicate: pred } = parseFilter({ path: '[unclosed' }, workspace, graph, false);
    expect(pred(noteA)).toBe(false);
  });

  it('links_to filter matches notes that have an outbound link to the identifier', () => {
    const noteA = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] });
    const noteB = createTestNote({ uri: '/b.md' });
    const noteC = createTestNote({ uri: '/c.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB, noteC]);

    const { predicate: pred } = parseFilter({ links_to: 'b' }, workspace, graph, false);
    expect(pred(noteA)).toBe(true); // noteA links to noteB
    expect(pred(noteB)).toBe(false); // noteB doesn't link to noteB
    expect(pred(noteC)).toBe(false); // noteC doesn't link to noteB
  });

  it('links_from filter matches notes that are linked from the identifier', () => {
    const noteA = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] });
    const noteB = createTestNote({ uri: '/b.md' });
    const noteC = createTestNote({ uri: '/c.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB, noteC]);

    const { predicate: pred } = parseFilter({ links_from: 'a' }, workspace, graph, false);
    expect(pred(noteA)).toBe(false); // noteA is the source, not the target
    expect(pred(noteB)).toBe(true); // noteB is linked from noteA
    expect(pred(noteC)).toBe(false); // noteC is not linked from noteA
  });

  it('links_to returns false for all when identifier is not found', () => {
    const noteA = createTestNote({ uri: '/a.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const { predicate: pred } = parseFilter(
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

    const { predicate: pred } = parseFilter(
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

    const { predicate: pred } = parseFilter(
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

    const { predicate: pred } = parseFilter(
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

    const { predicate: pred } = parseFilter(
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

    const { predicate: pred } = parseFilter(
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

describe('parseFilter — jexl', () => {
  it('matches resources whose context satisfies the jexl expression', () => {
    const noteA = createTestNote({ uri: '/a.md', type: 'type-1' });
    const noteB = createTestNote({ uri: '/b.md', type: 'type-2' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const { predicate: pred } = parseFilter(
      { jexl: 'resource.type == "type-1"' },
      workspace,
      graph,
      false
    );
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
  });

  it('jexl is evaluated regardless of the trusted flag', () => {
    const noteA = createTestNote({ uri: '/a.md', type: 'type-1' });
    const noteB = createTestNote({ uri: '/b.md', type: 'type-2' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const { predicate: pred } = parseFilter(
      { jexl: 'resource.type == "type-1"' },
      workspace,
      graph,
      false
    );
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
  });

  it('jexl can access graph-derived backlinks', () => {
    const noteA = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] });
    const noteB = createTestNote({ uri: '/b.md' });
    const noteC = createTestNote({ uri: '/c.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB, noteC]);

    const { predicate: pred } = parseFilter(
      { jexl: 'resource.backlinks|length > 0' },
      workspace,
      graph,
      false
    );
    expect(pred(noteA)).toBe(false);
    expect(pred(noteB)).toBe(true);
    expect(pred(noteC)).toBe(false);
  });

  it('jexl runtime error excludes the resource and does not throw', () => {
    const noteA = createTestNote({ uri: '/a.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    // Referencing a non-callable as a function — should fail to evaluate.
    const { predicate: pred } = parseFilter(
      { jexl: 'resource.title.notAFunction()' },
      workspace,
      graph,
      false
    );
    expect(pred(noteA)).toBe(false);
  });

  it('jexl syntax error excludes the resource and does not throw', () => {
    const noteA = createTestNote({ uri: '/a.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const { predicate: pred } = parseFilter(
      { jexl: '!!!invalid syntax!!!' },
      workspace,
      graph,
      false
    );
    expect(pred(noteA)).toBe(false);
  });

  it('jexl cannot reach host globals via prototype walk', () => {
    const noteA = createTestNote({ uri: '/a.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    // Classic sandbox-escape attempt. Jexl has no member-access to
    // constructors, so this must not match and must not throw.
    const { predicate: pred } = parseFilter(
      {
        jexl: 'resource.constructor.constructor("return process")() != null',
      },
      workspace,
      graph,
      false
    );
    expect(pred(noteA)).toBe(false);
  });
});

describe('parseFilter — expression (deprecated)', () => {
  it('expression is not evaluated and matches nothing', () => {
    const noteA = createTestNote({ uri: '/a.md', type: 'type-1' });
    const noteB = createTestNote({ uri: '/b.md', type: 'type-2' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const { predicate: pred } = parseFilter(
      { expression: 'resource.type === "type-1"' },
      workspace,
      graph,
      true
    );
    expect(pred(noteA)).toBe(false);
    expect(pred(noteB)).toBe(false);
  });

  it('when both expression and jexl are present, jexl takes effect and expression is ignored', () => {
    const noteA = createTestNote({ uri: '/a.md', type: 'type-1' });
    const noteB = createTestNote({ uri: '/b.md', type: 'type-2' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const { predicate: pred } = parseFilter(
      {
        // would match nothing — proves it's ignored
        expression: 'false',
        jexl: 'resource.type == "type-1"',
      },
      workspace,
      graph,
      true
    );
    expect(pred(noteA)).toBe(true);
    expect(pred(noteB)).toBe(false);
  });
});

describe('parseFilter — warnings', () => {
  it('clean filter reports no warnings', () => {
    const noteA = createTestNote({ uri: '/a.md', tags: ['research'] });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const { warnings } = parseFilter(
      { tag: 'research' },
      workspace,
      graph,
      false
    );
    expect(warnings).toEqual([]);
  });

  it('reports a warning when a path regex is catastrophically backtracking', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const { warnings } = parseFilter(
      { path: '(a+)+$' },
      workspace,
      graph,
      false
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('path filter');
    expect(warnings[0]).toContain('(a+)+$');
  });

  it('reports a warning when a title regex has invalid syntax', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const { warnings } = parseFilter(
      { title: '[unclosed' },
      workspace,
      graph,
      false
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('title filter');
  });

  it('reports a warning when links_to target is missing', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const { warnings } = parseFilter(
      { links_to: 'ghost' },
      workspace,
      graph,
      false
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('links_to');
    expect(warnings[0]).toContain('ghost');
  });

  it('reports a warning when jexl fails to compile', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const { warnings } = parseFilter(
      { jexl: ') unclosed' },
      workspace,
      graph,
      false
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('jexl');
  });

  it('reports a deprecation warning when the legacy expression field is used', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const { warnings } = parseFilter(
      { expression: 'resource.type === "x"' },
      workspace,
      graph,
      false
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('expression');
    expect(warnings[0]).toContain('deprecated');
  });

  it('aggregates warnings from nested and/or/not branches', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const { warnings } = parseFilter(
      {
        and: [
          { links_to: 'ghost-a' },
          { or: [{ links_from: 'ghost-b' }, { jexl: '!!!' }] },
          { not: { path: '(a+)+$' } },
        ],
      },
      workspace,
      graph,
      false
    );
    expect(warnings).toHaveLength(4);
    expect(warnings.some(w => w.includes('ghost-a'))).toBe(true);
    expect(warnings.some(w => w.includes('ghost-b'))).toBe(true);
    expect(warnings.some(w => w.includes('jexl'))).toBe(true);
    expect(warnings.some(w => w.includes('path filter'))).toBe(true);
  });

  it('reports a warning when a shorthand "[[id]]" target is missing', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const { warnings } = parseFilter(
      '[[ghost]]',
      workspace,
      graph,
      false
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('ghost');
  });

  it('reports a warning when a shorthand regex is rejected', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const { warnings } = parseFilter('/(a+)+$/', workspace, graph, false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('shorthand');
  });
});

describe('executeQuery — warnings', () => {
  it('threads filter warnings through to the execution result', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const { warnings } = executeQuery(
      { filter: { links_to: 'ghost' } },
      workspace,
      graph,
      { trusted: false }
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('ghost');
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

    const { results } = executeQuery(
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

    const { results: [result] } = executeQuery({}, workspace, graph, { trusted: false });
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('path');
    expect(Object.keys(result)).toHaveLength(2);
  });

  it('computed field backlink-count reflects graph state', () => {
    const noteA = createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] });
    const noteB = createTestNote({ uri: '/b.md' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA, noteB]);

    const { results } = executeQuery(
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

    const { results } = executeQuery(
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

    const { results: [result] } = executeQuery(
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

    const { results } = executeQuery(
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

    const { results } = executeQuery(
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

    const { results: baseline } = executeQuery(
      { select: ['title'] },
      workspace,
      graph,
      { trusted: false }
    );
    const { results: sorted } = executeQuery(
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
    const { results } = executeQuery(
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
    const { results } = executeQuery(
      { sort: 'title', offset: 2, select: ['title'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(results.map(r => r.title)).toEqual(['C', 'D']);
  });

  it('limit and offset together', () => {
    const { workspace, graph } = makeWorkspaceAndGraph(notes);
    const { results } = executeQuery(
      { sort: 'title', offset: 1, limit: 2, select: ['title'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(results.map(r => r.title)).toEqual(['B', 'C']);
  });

  it('limit larger than result count returns all results', () => {
    const { workspace, graph } = makeWorkspaceAndGraph(notes);
    const { results } = executeQuery(
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
    const { results } = executeQuery({}, workspace, graph, { trusted: false });
    expect(results).toEqual([]);
  });

  it('returns empty array when no notes match the filter', () => {
    const noteA = createTestNote({ uri: '/a.md', type: 'note' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const { results } = executeQuery(
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
    const { results } = executeQuery(query, workspace, graph, { trusted: false });
    expect(results).toHaveLength(2);
    expect(results.map(r => r.title)).toEqual(['Gamma', 'Beta']);
  });
});
