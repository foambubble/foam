import { withMcpServer } from '../test-setup';

const SEED = {
  'a.md': '---\ntitle: Note A\ntags: [foo, bar]\n---\n# A\n\nLinks to [[b]].',
  'b.md': '---\ntitle: Note B\n---\n# B\n\nReferences [[c]].',
  'subdir/c.md': '# C\n\nLeaf note.',
};

describe('resource tools', () => {
  it('list_resources returns all notes by default', () =>
    withMcpServer(SEED, async ctx => {
      const items = await ctx.callToolJson<
        Array<{ uri: string; title: string }>
      >('list_resources');
      expect(items.map(i => i.uri).sort()).toEqual([
        'a.md',
        'b.md',
        'subdir/c.md',
      ]);
    }));

  it('list_resources filters by tag', () =>
    withMcpServer(SEED, async ctx => {
      const items = await ctx.callToolJson<
        Array<{ uri: string; tags: string[] }>
      >('list_resources', { tag: 'foo' });
      expect(items.map(i => i.uri)).toEqual(['a.md']);
    }));

  it('get_resource returns metadata + link identifiers', () =>
    withMcpServer(SEED, async ctx => {
      const detail = await ctx.callToolJson<{
        uri: string;
        title: string;
        tags: string[];
        links?: { outgoing: string[]; incoming: string[] };
      }>('get_resource', { uri: 'a.md' });
      expect(detail.title).toBe('Note A');
      expect(detail.tags.sort()).toEqual(['bar', 'foo']);
      expect(detail.links?.outgoing).toContain('b');
    }));

  it('read_resource returns the raw markdown content', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callToolJson<{ content: string }>(
        'read_resource',
        { uri: 'a.md' }
      );
      expect(result.content).toBe(SEED['a.md']);
    }));

  it('read_resource on a missing file returns a structured error', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callTool('read_resource', { uri: 'missing.md' });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('resource_not_found');
    }));

  it('update_resource with content overwrites the file', () =>
    withMcpServer(SEED, async ctx => {
      await ctx.callToolJson('update_resource', {
        uri: 'a.md',
        content: '# A — updated',
      });
      const after = await ctx.callToolJson<{ content: string }>(
        'read_resource',
        { uri: 'a.md' }
      );
      expect(after.content).toBe('# A — updated');
    }));

  it('update_resource with properties merges frontmatter', () =>
    withMcpServer(SEED, async ctx => {
      await ctx.callToolJson('update_resource', {
        uri: 'a.md',
        properties: { status: 'active' },
      });
      const after = await ctx.callToolJson<{ content: string }>(
        'read_resource',
        { uri: 'a.md' }
      );
      expect(after.content).toContain('status: active');
      expect(after.content).toContain('title: Note A');
    }));

  it('delete_resource without confirm returns invalid_input', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callTool('delete_resource', { uri: 'a.md' });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('invalid_input');
    }));

  it('delete_resource permanently removes the file when permanent=true', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callToolJson<{
        deleted: boolean;
        trashed: boolean;
      }>('delete_resource', {
        uri: 'subdir/c.md',
        confirm: true,
        permanent: true,
      });
      expect(result.deleted).toBe(true);
      expect(result.trashed).toBe(false);
      const read = await ctx.callTool('read_resource', { uri: 'subdir/c.md' });
      expect(read.isError).toBe(true);
    }));
});

describe('resource tools — path traversal containment', () => {
  it('read_resource rejects absolute paths outside the workspace', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callTool('read_resource', {
        uri: '/etc/passwd',
      });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('invalid_input');
    }));

  it('read_resource rejects file:// URIs outside the workspace', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callTool('read_resource', {
        uri: 'file:///etc/passwd',
      });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('invalid_input');
    }));

  it('read_resource rejects relative paths that escape the workspace', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callTool('read_resource', {
        uri: '../../etc/passwd',
      });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('invalid_input');
    }));

  it('read_resource still accepts absolute paths inside the workspace', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callToolJson<{ content: string }>(
        'read_resource',
        { uri: '/workspace/a.md' }
      );
      expect(result.content).toBe(SEED['a.md']);
    }));

  it('update_resource rejects absolute paths outside the workspace', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callTool('update_resource', {
        uri: '/tmp/path-traversal-write.txt',
        content: 'pwned',
      });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('invalid_input');
    }));

  it('delete_resource rejects absolute paths outside the workspace', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callTool('delete_resource', {
        uri: '/etc/passwd',
        confirm: true,
        permanent: true,
      });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('invalid_input');
    }));

  it('move_resource rejects uri outside the workspace', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callTool('move_resource', {
        uri: '/etc/passwd',
        new_path: 'renamed.md',
      });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('invalid_input');
    }));

  it('move_resource rejects new_path outside the workspace', () =>
    withMcpServer(SEED, async ctx => {
      const result = await ctx.callTool('move_resource', {
        uri: 'a.md',
        new_path: '/etc/escaped.md',
      });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('invalid_input');
    }));
});

describe('resource tools — JS template execution', () => {
  // A `.foam/templates/new-note.js` would otherwise be picked up and
  // executed by `noteCreate`. The MCP server is agent-driven and never
  // trusted, so the JS template must be refused.
  const JS_TEMPLATE_SEED = {
    'existing.md': '# existing',
    '.foam/templates/new-note.js': `
      module.exports = async () => ({
        filepath: 'pwned.md',
        content: 'should not appear',
      });
    `,
  };

  it('create_resource refuses to execute JS templates', () =>
    withMcpServer(JS_TEMPLATE_SEED, async ctx => {
      const result = await ctx.callTool('create_resource', { title: 'hello' });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('untrusted_workspace');
      expect(err.data?.templatePath).toBe('/workspace/.foam/templates/new-note.js');
    }));

  it('create_resource rejects absolute dir outside the workspace', () =>
    withMcpServer({ 'existing.md': '# existing' }, async ctx => {
      const result = await ctx.callTool('create_resource', {
        title: 'shell',
        dir: '/etc/cron.hourly',
      });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('invalid_input');
    }));

  it('create_resource rejects relative dir that escapes the workspace', () =>
    withMcpServer({ 'existing.md': '# existing' }, async ctx => {
      const result = await ctx.callTool('create_resource', {
        title: 'shell',
        dir: '../../etc',
      });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('invalid_input');
    }));

  it('create_resource accepts a relative dir inside the workspace', () =>
    withMcpServer({ 'existing.md': '# existing' }, async ctx => {
      const result = await ctx.callToolJson<{ uri: string }>(
        'create_resource',
        { title: 'hello', dir: 'subdir' }
      );
      expect(result.uri).toBe('subdir/hello.md');
    }));

  it('create_resource still works when no JS template is present', () =>
    withMcpServer({ 'existing.md': '# existing' }, async ctx => {
      const result = await ctx.callToolJson<{ uri: string; title: string }>(
        'create_resource',
        { title: 'hello' }
      );
      expect(result.uri).toBe('hello.md');
      expect(result.title).toBe('hello');
    }));
});

describe('resource tools (read-only mode)', () => {
  it('write tools are not registered in read-only mode', () =>
    withMcpServer(SEED, { mode: 'read' }, async ctx => {
      const list = await ctx.client.listTools();
      const names = list.tools.map(t => t.name);
      expect(names).not.toContain('update_resource');
      expect(names).not.toContain('create_resource');
      expect(names).not.toContain('delete_resource');
      expect(names).not.toContain('move_resource');
    }));

  it('read tools still work in read-only mode', () =>
    withMcpServer(SEED, { mode: 'read' }, async ctx => {
      const items = await ctx.callToolJson<Array<unknown>>('list_resources');
      expect(items.length).toBe(3);
    }));
});
