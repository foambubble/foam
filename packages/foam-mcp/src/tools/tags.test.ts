import { buildTestHarness } from '../test-setup';

const SEED = {
  'a.md': '---\ntitle: A\ntags: [project, urgent]\n---\n# A',
  'b.md': '---\ntitle: B\ntags: [project]\n---\n# B',
  'c.md': '---\ntitle: C\ntags: [archive]\n---\n# C',
};

describe('tag tools', () => {
  it('list_tags returns counts sorted by frequency', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const tags = await h.callToolJson<Array<{ tag: string; count: number }>>(
        'list_tags'
      );
      const project = tags.find(t => t.tag === 'project');
      expect(project!.count).toBe(2);
    } finally {
      await h.close();
    }
  });

  it('search_by_tag returns notes with that tag', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const results = await h.callToolJson<Array<{ uri: string }>>(
        'search_by_tag',
        { tag: 'project' }
      );
      expect(results.map(r => r.uri).sort()).toEqual(['a.md', 'b.md']);
    } finally {
      await h.close();
    }
  });

  it('add_tags appends to frontmatter without duplicating', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const result = await h.callToolJson<{ tags: string[] }>('add_tags', {
        uri: 'a.md',
        tags: ['project', 'new-tag'],
      });
      // 'project' already present, so no duplicate
      expect(result.tags.sort()).toEqual(['new-tag', 'project', 'urgent']);
    } finally {
      await h.close();
    }
  });

  it('remove_tags strips listed tags', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const result = await h.callToolJson<{ tags: string[] }>('remove_tags', {
        uri: 'a.md',
        tags: ['urgent'],
      });
      expect(result.tags).toEqual(['project']);
    } finally {
      await h.close();
    }
  });
});
