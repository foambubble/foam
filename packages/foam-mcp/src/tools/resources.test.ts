import { buildTestHarness } from '../test-setup';

const SEED = {
  'a.md': '---\ntitle: Note A\ntags: [foo, bar]\n---\n# A\n\nLinks to [[b]].',
  'b.md': '---\ntitle: Note B\n---\n# B\n\nReferences [[c]].',
  'subdir/c.md': '# C\n\nLeaf note.',
};

describe('resource tools', () => {
  it('list_resources returns all notes by default', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const items = await h.callToolJson<Array<{ uri: string; title: string }>>(
        'list_resources'
      );
      expect(items.map(i => i.uri).sort()).toEqual([
        'a.md',
        'b.md',
        'subdir/c.md',
      ]);
    } finally {
      await h.close();
    }
  });

  it('list_resources filters by tag', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const items = await h.callToolJson<Array<{ uri: string; tags: string[] }>>(
        'list_resources',
        { tag: 'foo' }
      );
      expect(items.map(i => i.uri)).toEqual(['a.md']);
    } finally {
      await h.close();
    }
  });

  it('get_resource returns metadata + link identifiers', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const detail = await h.callToolJson<{
        uri: string;
        title: string;
        tags: string[];
        links?: { outgoing: string[]; incoming: string[] };
      }>('get_resource', { uri: 'a.md' });
      expect(detail.title).toBe('Note A');
      expect(detail.tags.sort()).toEqual(['bar', 'foo']);
      expect(detail.links?.outgoing).toContain('b');
    } finally {
      await h.close();
    }
  });

  it('read_resource returns the raw markdown content', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const result = await h.callToolJson<{ content: string }>('read_resource', {
        uri: 'a.md',
      });
      expect(result.content).toBe(SEED['a.md']);
    } finally {
      await h.close();
    }
  });

  it('read_resource on a missing file returns a structured error', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const result = await h.callTool('read_resource', { uri: 'missing.md' });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('resource_not_found');
    } finally {
      await h.close();
    }
  });

  it('update_resource with content overwrites the file', async () => {
    const h = await buildTestHarness(SEED);
    try {
      await h.callToolJson('update_resource', {
        uri: 'a.md',
        content: '# A — updated',
      });
      const after = await h.callToolJson<{ content: string }>('read_resource', {
        uri: 'a.md',
      });
      expect(after.content).toBe('# A — updated');
    } finally {
      await h.close();
    }
  });

  it('update_resource with properties merges frontmatter', async () => {
    const h = await buildTestHarness(SEED);
    try {
      await h.callToolJson('update_resource', {
        uri: 'a.md',
        properties: { status: 'active' },
      });
      const after = await h.callToolJson<{ content: string }>('read_resource', {
        uri: 'a.md',
      });
      expect(after.content).toContain('status: active');
      // existing frontmatter preserved
      expect(after.content).toContain('title: Note A');
    } finally {
      await h.close();
    }
  });

  it('delete_resource without confirm returns invalid_input', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const result = await h.callTool('delete_resource', { uri: 'a.md' });
      expect(result.isError).toBe(true);
      const err = JSON.parse(result.content[0].text!);
      expect(err.code).toBe('invalid_input');
    } finally {
      await h.close();
    }
  });

  it('delete_resource permanently removes the file when permanent=true', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const result = await h.callToolJson<{ deleted: boolean; trashed: boolean }>(
        'delete_resource',
        { uri: 'subdir/c.md', confirm: true, permanent: true }
      );
      expect(result.deleted).toBe(true);
      expect(result.trashed).toBe(false);
      const read = await h.callTool('read_resource', { uri: 'subdir/c.md' });
      expect(read.isError).toBe(true);
    } finally {
      await h.close();
    }
  });
});

describe('resource tools (read-only mode)', () => {
  it('write tools are not registered in read-only mode', async () => {
    const h = await buildTestHarness(SEED, { readOnly: true });
    try {
      const list = await h.client.listTools();
      const names = list.tools.map(t => t.name);
      expect(names).not.toContain('update_resource');
      expect(names).not.toContain('create_resource');
      expect(names).not.toContain('delete_resource');
      expect(names).not.toContain('move_resource');
    } finally {
      await h.close();
    }
  });

  it('read tools still work in read-only mode', async () => {
    const h = await buildTestHarness(SEED, { readOnly: true });
    try {
      const items = await h.callToolJson<Array<unknown>>('list_resources');
      expect(items.length).toBe(3);
    } finally {
      await h.close();
    }
  });
});
