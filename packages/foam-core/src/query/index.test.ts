import { Logger } from '../utils/log';
import { FoamGraph } from '../model/graph';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { executeQuery, parseFilter, QueryDescriptor, QueryResult } from '.';
import { createMarkdownParser } from '../services/markdown-parser';
import { URI } from '../model/uri';

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
  it('returns the selected fields plus the implicit `uri` handle', () => {
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
    expect(results[0].title).toBe('Alpha');
    expect(results[0].tags).toEqual(['t1']);
    // `uri` is always projected — the URI is the resource's identity, not
    // just another field. Renderers, JS query consumers, and link generation
    // rely on it being present unconditionally.
    expect(results[0].uri).toBe(noteA.uri);
    expect(results[0]).not.toHaveProperty('path');
  });

  it('defaults to [title, path] when select is omitted (plus implicit `uri`)', () => {
    const noteA = createTestNote({ uri: '/a.md', title: 'Alpha' });
    const { workspace, graph } = makeWorkspaceAndGraph([noteA]);

    const { results: [result] } = executeQuery({}, workspace, graph, { trusted: false });
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('path');
    expect(result.uri).toBe(noteA.uri);
    // title + path + uri
    expect(Object.keys(result)).toHaveLength(3);
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

// ─── source-derived fields: body / content / section[Label] ───────────────────
//
// These tests pin the behaviour of selectable fields that derive from the raw
// note text. The query layer is given an injected `readSource(uri)` callback so
// it can stay independent of `IDataStore`'s async API and of file I/O.

describe('executeQuery — source-derived fields', () => {
  const parser = createMarkdownParser();

  function parseNote(uriPath: string, markdown: string) {
    const uri = URI.file(uriPath);
    return parser.parse(uri, markdown);
  }

  it('`body` returns the note text minus frontmatter, keeping the H1 title', () => {
    const markdown = `---\nstatus: to_ask\n---\n# Question\n\nWhat is X?\n`;
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      { select: ['body'] },
      workspace,
      graph,
      { trusted: false, readSource: () => markdown }
    );
    expect(results).toHaveLength(1);
    expect(results[0].body).toContain('# Question');
    expect(results[0].body).toContain('What is X?');
    expect(results[0].body).not.toContain('status: to_ask');
    expect(results[0].body).not.toContain('---');
  });

  it('`content` strips frontmatter AND the H1 title', () => {
    const markdown = `---\nstatus: to_ask\n---\n# Question\n\nWhat is X?\n`;
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      { select: ['content'] },
      workspace,
      graph,
      { trusted: false, readSource: () => markdown }
    );
    expect(results[0].content).toContain('What is X?');
    expect(results[0].content).not.toContain('# Question');
    expect(results[0].content).not.toContain('status: to_ask');
  });

  it('strips a CRLF-delimited frontmatter block (Windows-authored notes)', () => {
    // Use \r\n line endings everywhere — gray-matter handles them, the
    // previous hand-rolled splitter did not, so this catches the regression.
    const markdown =
      '---\r\nstatus: to_ask\r\n---\r\n# Question\r\n\r\nWhat is X?\r\n';
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      { select: ['body', 'content'] },
      workspace,
      graph,
      { trusted: false, readSource: () => markdown }
    );
    expect(results[0].body).not.toContain('status: to_ask');
    expect(results[0].body).not.toContain('---');
    // Body must start at the H1, not with leftover CR from the closing
    // delimiter line.
    expect(results[0].body).toMatch(/^# Question/);
    expect(results[0].content).not.toContain('# Question');
    expect(results[0].content).toContain('What is X?');
    // Content must start at the body, not with leftover CR from the H1 line.
    expect(results[0].content).toMatch(/^What is X\?/);
  });

  it('strips CRLF frontmatter when the note has no trailing newline', () => {
    // The hand-rolled splitter scans for `\n---\n` which fails when the
    // closing delimiter is followed by `\r\n` and there is no terminating
    // newline at the end of the document — a common shape for hand-edited
    // files saved without a final EOL.
    const markdown = '---\r\nstatus: x\r\n---\r\nbody line';
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      { select: ['body'] },
      workspace,
      graph,
      { trusted: false, readSource: () => markdown }
    );
    expect(results[0].body).toBe('body line');
  });

  it('`section[Label]` returns the matching section content with heading stripped', () => {
    const markdown =
      `# Top\n\n## Question\n\nWhat is X?\n\n### Followup\n\nWhy?\n\n## Other\n\nElse.\n`;
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      { select: ['section[Question]'] },
      workspace,
      graph,
      { trusted: false, readSource: () => markdown }
    );
    // Heading line dropped; sub-section preserved; sibling "Other" not included.
    const value = results[0]['section[Question]'] as string;
    expect(value).toContain('What is X?');
    expect(value).toContain('### Followup');
    expect(value).toContain('Why?');
    expect(value).not.toContain('## Question');
    expect(value).not.toContain('## Other');
    expect(value).not.toContain('Else.');
  });

  it('`section[Label]` supports labels with spaces', () => {
    const markdown = `# Top\n\n## My Section\n\nBody here.\n`;
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      { select: ['section[My Section]'] },
      workspace,
      graph,
      { trusted: false, readSource: () => markdown }
    );
    expect(results[0]['section[My Section]']).toContain('Body here.');
  });

  it('`section[Label]` returns undefined when the label is missing', () => {
    const markdown = `# Top\n\n## Foo\n\nx\n`;
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      { select: ['section[Missing]'] },
      workspace,
      graph,
      { trusted: false, readSource: () => markdown }
    );
    expect(results[0]['section[Missing]']).toBeUndefined();
  });

  it('reads each note source at most once even when multiple source-derived fields are selected', () => {
    const markdown = `# T\n\n## S\n\nx\n`;
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    let reads = 0;
    executeQuery(
      { select: ['body', 'content', 'section[S]'] },
      workspace,
      graph,
      {
        trusted: false,
        readSource: () => {
          reads++;
          return markdown;
        },
      }
    );
    expect(reads).toBe(1);
  });

  it('does not call readSource when no source-derived field is selected', () => {
    const note = parseNote('/q.md', `# T\n\nbody\n`);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    let reads = 0;
    executeQuery(
      { select: ['title', 'path'] },
      workspace,
      graph,
      {
        trusted: false,
        readSource: () => {
          reads++;
          return '';
        },
      }
    );
    expect(reads).toBe(0);
  });

  it('`body` strips a YAML frontmatter block so it is not rendered as a cell', () => {
    const markdown = `---\nstatus: to_ask\ntitle: Q\n---\n# Question\n\nWhat is X?\n`;
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      { select: ['body'] },
      workspace,
      graph,
      { trusted: false, readSource: () => markdown }
    );
    const body = results[0].body as string;
    expect(body).not.toContain('---');
    expect(body).not.toContain('status: to_ask');
    expect(body).toContain('# Question');
  });

  it('`content` returns the source (modulo trim) when there is no H1 title', () => {
    const markdown = `Just a paragraph with no heading.\n\nAnother line.\n`;
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      { select: ['content'] },
      workspace,
      graph,
      { trusted: false, readSource: () => markdown }
    );
    // `stripFrontMatter` trims whitespace at the ends; the body stays intact.
    expect(results[0].content).toBe(markdown.trim());
  });

  it('`section[Label]` returns the first matching section when the label is duplicated', () => {
    const markdown =
      `# Top\n\n## Notes\n\nfirst block\n\n## Notes\n\nsecond block\n`;
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      { select: ['section[Notes]'] },
      workspace,
      graph,
      { trusted: false, readSource: () => markdown }
    );
    const value = results[0]['section[Notes]'] as string;
    expect(value).toContain('first block');
    expect(value).not.toContain('second block');
  });

  it('`section[Label]` matches the section name case-sensitively', () => {
    // Embeds (`![[note#Section]]`) match section labels case-sensitively;
    // queries follow the same convention so users can copy labels between
    // them without surprises.
    const markdown = `# Top\n\n## Question\n\nWhat is X?\n`;
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      {
        select: ['section[Question]', 'section[question]', 'section[QUESTION]'],
      },
      workspace,
      graph,
      { trusted: false, readSource: () => markdown }
    );
    expect(results[0]['section[Question]']).toContain('What is X?');
    expect(results[0]['section[question]']).toBeUndefined();
    expect(results[0]['section[QUESTION]']).toBeUndefined();
  });

  it('`section[Label]` returns content for the last section even with no trailing newline', () => {
    // Boundary case: when the section is the last thing in the file there's
    // no following heading to bound it. `Resource.sections[].range.end` for
    // the trailing section points at EOF — make sure we still slice the
    // body correctly and don't accidentally slice past the end.
    const markdown = '# Top\n\n## Last\n\nthe last line';
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      { select: ['section[Last]'] },
      workspace,
      graph,
      { trusted: false, readSource: () => markdown }
    );
    expect(results[0]['section[Last]']).toContain('the last line');
    expect(results[0]['section[Last]']).not.toContain('## Last');
  });

  it('`section[Label]` handles CRLF line endings', () => {
    const markdown = '# Top\r\n\r\n## Foo\r\n\r\ninside foo\r\n';
    const note = parseNote('/q.md', markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      { select: ['section[Foo]'] },
      workspace,
      graph,
      { trusted: false, readSource: () => markdown }
    );
    expect(results[0]['section[Foo]']).toContain('inside foo');
    expect(results[0]['section[Foo]']).not.toContain('## Foo');
  });

  it('applies limit before reading source so a `limit: 1` query reads at most one body', () => {
    // DoS guard: without this, a workspace-wide query like
    // `filter: '*', select: [body], limit: 1` would synchronously read and
    // project every matching note before slicing the results, even though
    // only one row is ever shown.
    const notes = [
      parseNote('/a.md', '# A\n\na body\n'),
      parseNote('/b.md', '# B\n\nb body\n'),
      parseNote('/c.md', '# C\n\nc body\n'),
      parseNote('/d.md', '# D\n\nd body\n'),
    ];
    const workspace = createTestWorkspace();
    notes.forEach(n => workspace.set(n));
    const graph = FoamGraph.fromWorkspace(workspace, false);

    let reads = 0;
    executeQuery(
      { filter: '*', select: ['body'], limit: 1 },
      workspace,
      graph,
      {
        trusted: false,
        readSource: () => {
          reads++;
          return 'whatever';
        },
      }
    );
    expect(reads).toBe(1);
  });

  it('applies offset + limit before reading source', () => {
    const notes = [
      parseNote('/a.md', '# A\n'),
      parseNote('/b.md', '# B\n'),
      parseNote('/c.md', '# C\n'),
      parseNote('/d.md', '# D\n'),
    ];
    const workspace = createTestWorkspace();
    notes.forEach(n => workspace.set(n));
    const graph = FoamGraph.fromWorkspace(workspace, false);

    let reads = 0;
    executeQuery(
      { filter: '*', select: ['body'], offset: 1, limit: 2 },
      workspace,
      graph,
      {
        trusted: false,
        readSource: () => {
          reads++;
          return 'whatever';
        },
      }
    );
    // Two rows survive the slice → at most two source reads.
    expect(reads).toBe(2);
  });

  it('sorting on a non-source field still applies limit before reading source', () => {
    // Sorting needs the full pre-projection set in row order to be correct,
    // but the sort key (`title`) is not source-derived, so we can sort the
    // skeleton rows first and only read source for the surviving slice.
    const notes = [
      parseNote('/c.md', '# C\n'),
      parseNote('/a.md', '# A\n'),
      parseNote('/b.md', '# B\n'),
    ];
    const workspace = createTestWorkspace();
    notes.forEach(n => workspace.set(n));
    const graph = FoamGraph.fromWorkspace(workspace, false);

    let reads = 0;
    const { results } = executeQuery(
      {
        filter: '*',
        select: ['title', 'body'],
        sort: 'title ASC',
        limit: 1,
      },
      workspace,
      graph,
      {
        trusted: false,
        readSource: () => {
          reads++;
          return 'whatever';
        },
      }
    );
    // Only the top-of-sort note's source should be read.
    expect(reads).toBe(1);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('A');
  });

  it('source-derived fields resolve to undefined when no readSource is provided', () => {
    const note = parseNote('/q.md', `# T\n\nbody\n`);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);

    const { results } = executeQuery(
      { select: ['title', 'body', 'content', 'section[S]'] },
      workspace,
      graph,
      { trusted: false }
    );
    expect(results[0].title).toBe('T');
    expect(results[0].body).toBeUndefined();
    expect(results[0].content).toBeUndefined();
    expect(results[0]['section[S]']).toBeUndefined();
  });
});

// ─── QueryResult (foam-query-js) — source projection ─────────────────────────
//
// The fluent JS builder must avoid the same DoS shape that `executeQuery`
// now guards against: selecting `body` with a `limit` over a large workspace
// shouldn't read every matched note's source before slicing. Pinned here
// because the JS path historically applied sort/limit *after* projection.

describe('QueryResult.toArray — source-derived fields', () => {
  const parser = createMarkdownParser();
  const parseNote = (uriPath: string, markdown: string) =>
    parser.parse(URI.file(uriPath), markdown);

  it('a .select([body]).limit(1) chain reads at most one source', () => {
    const notes = [
      parseNote('/a.md', '# A\n'),
      parseNote('/b.md', '# B\n'),
      parseNote('/c.md', '# C\n'),
      parseNote('/d.md', '# D\n'),
    ];
    const workspace = createTestWorkspace();
    notes.forEach(n => workspace.set(n));
    const graph = FoamGraph.fromWorkspace(workspace, false);

    let reads = 0;
    const readSource = () => {
      reads++;
      return 'whatever';
    };

    const qr = new QueryResult(workspace, graph, true, '*', readSource);
    qr.select(['body']).limit(1).toArray();
    expect(reads).toBe(1);
  });

  it('.sortBy + .limit reads sources only for the surviving slice', () => {
    const notes = [
      parseNote('/c.md', '# C\n'),
      parseNote('/a.md', '# A\n'),
      parseNote('/b.md', '# B\n'),
    ];
    const workspace = createTestWorkspace();
    notes.forEach(n => workspace.set(n));
    const graph = FoamGraph.fromWorkspace(workspace, false);

    let reads = 0;
    const readSource = () => {
      reads++;
      return 'whatever';
    };

    const qr = new QueryResult(workspace, graph, true, '*', readSource);
    const out = qr
      .select(['title', 'body'])
      .sortBy('title', 'asc')
      .limit(1)
      .toArray();
    expect(reads).toBe(1);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('A');
  });

  it('falls back to read-all when a .where predicate is present (predicate may read source)', () => {
    // A JS predicate could legitimately reference `r.body`, so we can't push
    // limit down — the predicate has to see every matched row, with source
    // populated, before sort/limit. Document the trade-off via this test:
    // adding `.where` opts out of the limit-before-read optimisation.
    const notes = [
      parseNote('/a.md', '# A\n'),
      parseNote('/b.md', '# B\n'),
      parseNote('/c.md', '# C\n'),
    ];
    const workspace = createTestWorkspace();
    notes.forEach(n => workspace.set(n));
    const graph = FoamGraph.fromWorkspace(workspace, false);

    let reads = 0;
    const readSource = () => {
      reads++;
      return 'whatever';
    };

    const qr = new QueryResult(workspace, graph, true, '*', readSource);
    qr.select(['body'])
      .where(() => true)
      .limit(1)
      .toArray();
    // All three matched rows had their source read so the predicate could
    // see them. Surfacing this in a test keeps the behaviour intentional
    // rather than accidental.
    expect(reads).toBe(3);
  });
});

describe('QueryResult.select — label support', () => {
  it('accepts a mix of strings and { field, label } objects and normalises both', () => {
    const notes = [createTestNote({ uri: '/a.md', title: 'A' })];
    const { workspace, graph } = makeWorkspaceAndGraph(notes);

    const qr = new QueryResult(workspace, graph, false, '*').select([
      'title',
      { field: 'properties.Status', label: 'State' },
      'section[Decision]',
    ]);

    expect(qr.descriptor.select).toEqual([
      { field: 'title', label: 'title' },
      { field: 'properties.Status', label: 'State' },
      { field: 'section[Decision]', label: 'Decision' },
    ]);
  });

  it('derives the label by beautifying the field when none is supplied', () => {
    const notes = [createTestNote({ uri: '/a.md', title: 'A' })];
    const { workspace, graph } = makeWorkspaceAndGraph(notes);

    const qr = new QueryResult(workspace, graph, false, '*').select([
      { field: 'properties.Status' },
      { field: 'section[Decision]' },
    ]);

    expect(qr.descriptor.select).toEqual([
      { field: 'properties.Status', label: 'Status' },
      { field: 'section[Decision]', label: 'Decision' },
    ]);
  });

  it('projects rows under the raw field key, not the label', () => {
    const notes = [
      createTestNote({ uri: '/a.md', title: 'A', properties: { Status: 'open' } }),
    ];
    const { workspace, graph } = makeWorkspaceAndGraph(notes);

    const rows = new QueryResult(workspace, graph, false, '*')
      .select([{ field: 'properties.Status', label: 'State' }])
      .toArray();

    expect(rows[0]['properties.Status']).toBe('open');
    expect(rows[0]['State']).toBeUndefined();
  });
});
