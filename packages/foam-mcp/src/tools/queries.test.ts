import { describe, expect, it } from 'vitest';
import { withMcpServer } from '../test-setup';

const SEED = {
  'wip.md': '# Wip\n\n#wip',
  'done.md': '# Done\n\n#archive',
  'other.md': '# Other\n\n#other',
  '.foam/queries/wip.yaml':
    'name: Work in Progress\ndescription: WIP notes\nfilter: "#wip"\n',
  '.foam/queries/archive.yaml': 'filter: "#archive"\n',
};

describe('query tools', () => {
  describe('list_queries', () => {
    it('returns every saved query with match counts', () =>
      withMcpServer(SEED, async ctx => {
        const items = await ctx.callToolJson<
          Array<{
            id: string;
            name: string;
            description?: string;
            matchCount: number;
            errors: string[];
          }>
        >('list_queries');
        const byId = Object.fromEntries(items.map(i => [i.id, i]));
        expect(byId.wip).toEqual({
          id: 'wip',
          name: 'Work in Progress',
          description: 'WIP notes',
          matchCount: 1,
          errors: [],
        });
        expect(byId.archive).toEqual({
          id: 'archive',
          name: 'Archive',
          description: undefined,
          matchCount: 1,
          errors: [],
        });
      }));

    it('returns an empty list when there are no saved queries', () =>
      withMcpServer({ 'a.md': '# A' }, async ctx => {
        const items = await ctx.callToolJson<unknown[]>('list_queries');
        expect(items).toEqual([]);
      }));
  });

  describe('get_query', () => {
    it('returns the descriptor and metadata for a saved query', () =>
      withMcpServer(SEED, async ctx => {
        const result = await ctx.callToolJson<{
          id: string;
          name: string;
          description?: string;
          descriptor: { filter?: unknown };
          errors: string[];
        }>('get_query', { id: 'wip' });
        expect(result.id).toBe('wip');
        expect(result.name).toBe('Work in Progress');
        expect(result.descriptor.filter).toBe('#wip');
        expect(result.errors).toEqual([]);
      }));

    it('errors when the saved query does not exist', () =>
      withMcpServer(SEED, async ctx => {
        await expect(
          ctx.callToolJson('get_query', { id: 'nope' })
        ).rejects.toThrow(/not found/i);
      }));
  });

  describe('run_query', () => {
    it('runs a saved query by id and returns matching URIs', () =>
      withMcpServer(SEED, async ctx => {
        const result = await ctx.callToolJson<{
          results: Array<{ uri: string }>;
          warnings: string[];
        }>('run_query', { id: 'wip' });
        expect(result.results.map(r => r.uri)).toEqual(['wip.md']);
        expect(result.warnings).toEqual([]);
      }));

    it('runs an ad-hoc descriptor when no id is given', () =>
      withMcpServer(SEED, async ctx => {
        const result = await ctx.callToolJson<{
          results: Array<{ uri: string }>;
        }>('run_query', {
          descriptor: { filter: '#archive' },
        });
        expect(result.results.map(r => r.uri)).toEqual(['done.md']);
      }));

    it('rejects when both id and descriptor are passed', () =>
      withMcpServer(SEED, async ctx => {
        await expect(
          ctx.callToolJson('run_query', {
            id: 'wip',
            descriptor: { filter: '#archive' },
          })
        ).rejects.toThrow(/exactly one/i);
      }));

    it('rejects when neither id nor descriptor is passed', () =>
      withMcpServer(SEED, async ctx => {
        await expect(ctx.callToolJson('run_query', {})).rejects.toThrow(
          /exactly one/i
        );
      }));

    it('errors when the saved id does not exist', () =>
      withMcpServer(SEED, async ctx => {
        await expect(
          ctx.callToolJson('run_query', { id: 'nope' })
        ).rejects.toThrow(/not found/i);
      }));
  });
});
