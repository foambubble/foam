import { buildTestHarness } from '../test-setup';

const SEED = {
  'meeting-notes.md':
    '---\ntitle: Meeting Notes\nstatus: active\n---\n# Meeting Notes',
  'project-plan.md':
    '---\ntitle: Project Plan\nstatus: archived\n---\n# Project Plan',
  'todo.md': '---\ntitle: TODO\nstatus: active\n---\n# TODO',
};

describe('search tools', () => {
  it('search_resources matches by title substring', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const matches = await h.callToolJson<Array<{ uri: string }>>(
        'search_resources',
        { query: 'project' }
      );
      expect(matches.map(m => m.uri)).toEqual(['project-plan.md']);
    } finally {
      await h.close();
    }
  });

  it('search_by_property finds notes with a given property value', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const matches = await h.callToolJson<Array<{ uri: string }>>(
        'search_by_property',
        { property: 'status', value: 'active' }
      );
      expect(matches.map(m => m.uri).sort()).toEqual([
        'meeting-notes.md',
        'todo.md',
      ]);
    } finally {
      await h.close();
    }
  });

  it('search_by_property without value matches any value', async () => {
    const h = await buildTestHarness(SEED);
    try {
      const matches = await h.callToolJson<Array<{ uri: string }>>(
        'search_by_property',
        { property: 'status' }
      );
      expect(matches.length).toBe(3);
    } finally {
      await h.close();
    }
  });
});
