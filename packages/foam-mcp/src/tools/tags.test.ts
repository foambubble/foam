import { withMcpServer } from '../test-setup';

const SEED = {
  'a.md': '---\ntitle: A\ntags: [project, urgent]\n---\n# A',
  'b.md': '---\ntitle: B\ntags: [project]\n---\n# B',
  'c.md': '---\ntitle: C\ntags: [archive]\n---\n# C',
};

describe('tag tools', () => {
  it('list_tags returns counts sorted by frequency', () =>
    withMcpServer(SEED, async ctx => {
      const tags = await ctx.callToolJson<Array<{ tag: string; count: number }>>(
        'list_tags'
      );
      const project = tags.find(t => t.tag === 'project');
      expect(project!.count).toBe(2);
    }));

  it('search_by_tag returns notes with that tag', () =>
    withMcpServer(SEED, async ctx => {
      const results = await ctx.callToolJson<Array<{ uri: string }>>(
        'search_by_tag',
        { tag: 'project' }
      );
      expect(results.map(r => r.uri).sort()).toEqual(['a.md', 'b.md']);
    }));

  it('add_tags appends to frontmatter without duplicating', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callToolJson<{ tags: string[] }>('add_tags', {
        uri: 'a.md',
        tags: ['project', 'new-tag'],
      });
      expect(result.tags.sort()).toEqual(['new-tag', 'project', 'urgent']);
    }));

  it('remove_tags strips listed tags', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callToolJson<{ tags: string[] }>('remove_tags', {
        uri: 'a.md',
        tags: ['urgent'],
      });
      expect(result.tags).toEqual(['project']);
    }));
});
