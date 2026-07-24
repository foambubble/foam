import { buildWatchGlob } from './watch-glob';

describe('buildWatchGlob', () => {
  it('builds a brace-expanded glob from multiple extensions', () => {
    expect(buildWatchGlob(['.md', '.pdf', '.png'])).toEqual('**/*.{md,pdf,png}');
  });

  it('builds a simple glob for a single extension', () => {
    expect(buildWatchGlob(['.md'])).toEqual('**/*.md');
  });

  it('accepts extensions with or without a leading dot', () => {
    expect(buildWatchGlob(['md', '.pdf'])).toEqual('**/*.{md,pdf}');
  });

  it('deduplicates repeated extensions', () => {
    expect(buildWatchGlob(['.md', 'md', '.md'])).toEqual('**/*.md');
  });

  it('ignores empty entries and whitespace', () => {
    expect(buildWatchGlob(['.md', '', '  ', '.pdf'])).toEqual('**/*.{md,pdf}');
  });

  it('falls back to watching everything when no extensions are given', () => {
    expect(buildWatchGlob([])).toEqual('**/*');
  });
});
