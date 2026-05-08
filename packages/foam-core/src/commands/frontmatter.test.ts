import {
  parseFrontmatter,
  stringifyFrontmatter,
  mergeFrontmatter,
  addTagsToFrontmatter,
  removeTagsFromFrontmatter,
} from './frontmatter';

describe('parseFrontmatter', () => {
  it('parses frontmatter properties and body', () => {
    const result = parseFrontmatter(
      '---\ntitle: A\ntags: [foo, bar]\n---\n# Body'
    );
    expect(result.hasFrontmatter).toBe(true);
    expect(result.properties).toEqual({ title: 'A', tags: ['foo', 'bar'] });
    expect(result.body.trim()).toBe('# Body');
  });

  it('returns hasFrontmatter=false for plain markdown', () => {
    const result = parseFrontmatter('# Just a heading\n\nNo frontmatter.');
    expect(result.hasFrontmatter).toBe(false);
    expect(result.properties).toEqual({});
  });

  // Regression test for gray-matter cache hit returning a shallow copy that
  // strips the non-enumerable `matter` field. Calling parseFrontmatter twice
  // with the same content used to throw "Cannot read properties of undefined
  // (reading 'trim')" on the second call.
  it('handles gray-matter cache hits when called repeatedly with the same content', () => {
    const content = '---\ntitle: A\ntags: [foo]\n---\n# A';
    const first = parseFrontmatter(content);
    const second = parseFrontmatter(content);
    expect(first.hasFrontmatter).toBe(true);
    expect(second.hasFrontmatter).toBe(true);
    expect(second.properties).toEqual({ title: 'A', tags: ['foo'] });
  });
});

describe('addTagsToFrontmatter / removeTagsFromFrontmatter', () => {
  const seed = '---\ntitle: A\ntags: [project, urgent]\n---\n# A';

  it('appends new tags without duplicates', () => {
    const result = addTagsToFrontmatter(seed, ['project', 'new']);
    expect(result.tags.sort()).toEqual(['new', 'project', 'urgent']);
  });

  it('removes specified tags', () => {
    const result = removeTagsFromFrontmatter(seed, ['urgent']);
    expect(result.tags).toEqual(['project']);
  });

  it('removes tags after add (regression — gray-matter cache pollution)', () => {
    addTagsToFrontmatter(seed, ['x']);
    const result = removeTagsFromFrontmatter(seed, ['urgent']);
    expect(result.tags).toEqual(['project']);
  });
});

describe('stringifyFrontmatter / mergeFrontmatter', () => {
  it('round-trips properties and body', () => {
    const merged = mergeFrontmatter('---\nstatus: draft\n---\nbody', {
      status: 'active',
    });
    const reparsed = parseFrontmatter(merged);
    expect(reparsed.properties.status).toBe('active');
    expect(reparsed.body.trim()).toBe('body');
  });

  it('emits an empty string body unchanged when properties is empty', () => {
    expect(stringifyFrontmatter('# body', {})).toBe('# body');
  });
});
