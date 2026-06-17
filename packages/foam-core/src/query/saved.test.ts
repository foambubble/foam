import { describe, expect, it } from 'vitest';
import {
  filenameFromQueryId,
  humanizeQueryId,
  idFromQueryFilename,
  parseQuery,
  sanitizeQueryId,
  serializeQuery,
} from './saved';

describe('parseQuery', () => {
  it('parses a minimal one-line filter', () => {
    const result = parseQuery('work-in-progress', 'filter: "#wip"\n');
    expect(result.errors).toEqual([]);
    expect(result.query).toEqual({
      id: 'work-in-progress',
      name: 'Work In Progress',
      description: undefined,
      descriptor: { filter: '#wip' },
    });
  });

  it('uses the provided name when present', () => {
    const result = parseQuery('wip', 'name: My WIP Notes\nfilter: "#wip"\n');
    expect(result.errors).toEqual([]);
    expect(result.query.name).toBe('My WIP Notes');
  });

  it('falls back to humanized id when name is missing', () => {
    const result = parseQuery('research-notes', 'filter: "#research"\n');
    expect(result.query.name).toBe('Research Notes');
  });

  it('falls back to humanized id when name is empty', () => {
    const result = parseQuery(
      'research-notes',
      'name: "   "\nfilter: "#research"\n'
    );
    expect(result.query.name).toBe('Research Notes');
  });

  it('preserves description', () => {
    const result = parseQuery(
      'wip',
      'description: Notes I am editing\nfilter: "#wip"\n'
    );
    expect(result.query.description).toBe('Notes I am editing');
  });

  it('passes through structured filters with sort/limit/select', () => {
    const yaml = `
filter:
  and:
    - tag: "#wip"
    - not:
        tag: "#archive"
sort: title ASC
limit: 50
select: [title, tags]
`;
    const result = parseQuery('wip', yaml);
    expect(result.errors).toEqual([]);
    expect(result.query.descriptor).toEqual({
      filter: {
        and: [{ tag: '#wip' }, { not: { tag: '#archive' } }],
      },
      sort: 'title ASC',
      limit: 50,
      select: ['title', 'tags'],
    });
  });

  it('reports unknown fields as errors but still parses the rest', () => {
    const result = parseQuery('wip', 'filter: "#wip"\nbogus: 42\n');
    expect(result.errors).toEqual(['Unknown field "bogus"']);
    expect(result.query.descriptor.filter).toBe('#wip');
  });

  it('rejects YAML that is not a mapping', () => {
    const result = parseQuery('wip', '- one\n- two\n');
    expect(result.query).toBeUndefined();
    expect(result.errors[0]).toContain('mapping');
  });

  it('rejects empty content', () => {
    const result = parseQuery('wip', '');
    expect(result.query).toBeUndefined();
    expect(result.errors).toEqual(['Query file is empty']);
  });

  it('reports invalid YAML syntax', () => {
    const result = parseQuery('wip', 'filter: "#wip\n  unbalanced\n');
    expect(result.query).toBeUndefined();
    expect(result.errors[0]).toContain('Invalid YAML');
  });
});

describe('serializeQuery', () => {
  it('round-trips a minimal query without emitting a redundant name', () => {
    const yaml = serializeQuery({
      id: 'wip',
      name: 'Wip',
      descriptor: { filter: '#wip' },
    });
    expect(yaml).not.toContain('name:');
    expect(yaml).toContain('filter:');
  });

  it('emits a custom name when it differs from the humanized id', () => {
    const yaml = serializeQuery({
      id: 'wip',
      name: 'My Active Work',
      descriptor: { filter: '#wip' },
    });
    expect(yaml).toContain('name: My Active Work');
  });

  it('emits description and structured filter', () => {
    const yaml = serializeQuery({
      id: 'wip',
      name: 'Wip',
      description: 'In flight notes',
      descriptor: {
        filter: { and: [{ tag: '#wip' }] },
        sort: 'title ASC',
        limit: 10,
      },
    });
    expect(yaml).toContain('description: In flight notes');
    expect(yaml).toContain('sort: title ASC');
    expect(yaml).toContain('limit: 10');
  });

  it('round-trips through parse + serialize without surprises', () => {
    const original = {
      id: 'research',
      name: 'My Research',
      descriptor: {
        filter: { and: [{ tag: '#research' }, { not: { tag: '#archive' } }] },
        sort: 'title ASC',
      },
    };
    const yaml = serializeQuery(original);
    const parsed = parseQuery('research', yaml);
    expect(parsed.errors).toEqual([]);
    expect(parsed.query).toEqual({
      ...original,
      description: undefined,
    });
  });
});

describe('id helpers', () => {
  it('idFromQueryFilename strips .yaml', () => {
    expect(idFromQueryFilename('foo.yaml')).toBe('foo');
    expect(idFromQueryFilename('foo.yml')).toBe('foo');
    expect(idFromQueryFilename('foo')).toBe('foo');
  });

  it('filenameFromQueryId adds .yaml', () => {
    expect(filenameFromQueryId('foo')).toBe('foo.yaml');
  });

  it('humanizeQueryId capitalizes words', () => {
    expect(humanizeQueryId('work-in-progress')).toBe('Work In Progress');
    expect(humanizeQueryId('research_notes')).toBe('Research Notes');
    expect(humanizeQueryId('one')).toBe('One');
  });

  it('sanitizeQueryId produces fs-safe ids', () => {
    expect(sanitizeQueryId('Work in Progress')).toBe('work-in-progress');
    expect(sanitizeQueryId('  My Notes!! ')).toBe('my-notes');
    expect(sanitizeQueryId('research/animals')).toBe('research-animals');
  });
});
