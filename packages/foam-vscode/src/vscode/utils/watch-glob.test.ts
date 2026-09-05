import {
  AttachmentResourceProvider,
  defaultAttachmentExtensions,
} from '@foam/core';
import { buildWatchGlob, buildWorkspaceWatchGlob } from './watch-glob';

describe('buildWatchGlob', () => {
  it('builds a brace-expanded glob from multiple extensions', () => {
    expect(buildWatchGlob(['.md', '.pdf', '.png'])).toEqual(
      '**/*.{md,pdf,png}'
    );
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

describe('buildWorkspaceWatchGlob', () => {
  it('watches every extension the attachment provider supports (#1697)', () => {
    // Images are attachments regardless of `foam.files.attachmentExtensions`:
    // the provider hardcodes them, so the watcher must cover them too, or a
    // pasted image is invisible until the window is reloaded.
    const provider = new AttachmentResourceProvider(
      defaultAttachmentExtensions
    );
    const glob = buildWorkspaceWatchGlob(['.md'], provider);

    for (const extension of provider.attachmentExtensions) {
      expect(glob).toContain(extension.replace(/^\./, ''));
    }
  });

  it('watches note extensions alongside attachments', () => {
    const provider = new AttachmentResourceProvider(['.pdf']);
    expect(buildWorkspaceWatchGlob(['.md', '.mdx'], provider)).toEqual(
      '**/*.{md,mdx,png,jpg,jpeg,gif,svg,webp,pdf}'
    );
  });
});
