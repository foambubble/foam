import { buildTestHarness } from '../test-setup';

describe('structure tools', () => {
  it('get_outline returns the heading structure', async () => {
    const h = await buildTestHarness({
      'note.md':
        '# Top heading\n\nIntro\n\n## Section 1\n\nText\n\n## Section 2\n\n### Sub\n',
    });
    try {
      const outline = await h.callToolJson<{
        sections: Array<{ label: string; level: number }>;
      }>('get_outline', { uri: 'note.md' });
      const labels = outline.sections.map(s => s.label);
      expect(labels).toContain('Section 1');
      expect(labels).toContain('Section 2');
      expect(labels).toContain('Sub');
    } finally {
      await h.close();
    }
  });
});
