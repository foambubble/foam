import { describe, expect, it } from 'vitest';
import { ExportContext, FoamGraph, URI } from '@foam/core';
import {
  createNoteFromMarkdown,
  createTestWorkspace,
} from '@foam/core/test';
import { computeStarlightRoute, starlightLocator } from './locator';
import { starlightAssetStrategy } from './asset-strategy';
import { createTestNote } from '../../test/test-utils';

const buildContext = (overrides: Partial<ExportContext> = {}): ExportContext => {
  const workspace = createTestWorkspace([URI.file('/')]);
  return {
    workspace,
    graph: FoamGraph.fromWorkspace(workspace),
    contentRoot: null,
    include: () => true,
    resources: [],
    notes: [],
    assets: [],
    exportedRoutes: [],
    exportedAssets: [],
    locations: new Map(),
    assetResolutions: new Map(),
    ...overrides,
  };
};

describe('StarlightLocator slugification', () => {
  it('lowercases segments and replaces spaces with dashes', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]);
    const note = createNoteFromMarkdown(
      'Title of my New Note.md',
      '# Title',
      root
    );
    workspace.set(note);
    expect(computeStarlightRoute(note.uri, buildContext({ workspace }))).toBe(
      '/title-of-my-new-note'
    );
  });

  it('lowercases every path segment, not just the filename', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]);
    const note = createNoteFromMarkdown(
      'Docs/Getting Started/Hello World.md',
      '# Hello',
      root
    );
    workspace.set(note);
    expect(computeStarlightRoute(note.uri, buildContext({ workspace }))).toBe(
      '/docs/getting-started/hello-world'
    );
  });

  it('collapses runs of non-alphanumeric characters into a single dash', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]);
    const note = createNoteFromMarkdown(
      'foo --- bar___baz!!!.md',
      '# Mixed',
      root
    );
    workspace.set(note);
    expect(computeStarlightRoute(note.uri, buildContext({ workspace }))).toBe(
      '/foo-bar-baz'
    );
  });

  it('is idempotent on already-kebab-case filenames', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]);
    const note = createNoteFromMarkdown('note-a.md', '# Note A', root);
    workspace.set(note);
    expect(computeStarlightRoute(note.uri, buildContext({ workspace }))).toBe(
      '/note-a'
    );
  });

  it('preserves "/" for top-level index/readme files', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]);
    const index = createNoteFromMarkdown('index.md', '# Home', root);
    const readme = createNoteFromMarkdown('README.md', '# Home', root);
    workspace.set(index);
    workspace.set(readme);
    expect(computeStarlightRoute(index.uri, buildContext({ workspace }))).toBe(
      '/'
    );
    expect(computeStarlightRoute(readme.uri, buildContext({ workspace }))).toBe(
      '/'
    );
  });

  it('slugifies parent path when a nested index file collapses up to its directory', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]);
    const note = createNoteFromMarkdown(
      'My Section/index.md',
      '# Section',
      root
    );
    workspace.set(note);
    expect(computeStarlightRoute(note.uri, buildContext({ workspace }))).toBe(
      '/my-section'
    );
  });

  it('locate() returns null for non-note resources', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]);
    const asset = createTestNote({
      uri: '/assets/logo.png',
      title: 'logo.png',
      type: 'image',
    });
    workspace.set(asset);
    expect(starlightLocator.locate(asset.uri, buildContext({ workspace }))).toBe(
      null
    );
  });

  it('locate() exposes sectionAnchor and sectionId that agree modulo the # prefix', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]);
    const note = createNoteFromMarkdown('guide.md', '# Guide', root);
    workspace.set(note);
    const location = starlightLocator.locate(
      note.uri,
      buildContext({ workspace })
    )!;
    expect(location.sectionAnchor('intro')).toBe('/guide#intro');
    expect(location.sectionId('intro')).toBe('intro');
  });
});

describe('StarlightAssetStrategy slugification', () => {
  it('slugifies asset directory segments and the filename stem, preserving extension', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]);
    const asset = createTestNote({
      uri: '/My Files/User Guide.PDF',
      title: 'User Guide.PDF',
      type: 'attachment',
    });
    workspace.set(asset);
    const resolution = starlightAssetStrategy.resolve(
      asset,
      buildContext({ workspace })
    );
    expect(resolution).toEqual({
      kind: 'file',
      outputPath: 'assets/my-files/user-guide.pdf',
    });
  });

  it('is idempotent on already-kebab asset paths', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]);
    const asset = createTestNote({
      uri: '/assets/logo.png',
      title: 'logo.png',
      type: 'image',
    });
    workspace.set(asset);
    const resolution = starlightAssetStrategy.resolve(
      asset,
      buildContext({ workspace })
    );
    expect(resolution).toEqual({
      kind: 'file',
      outputPath: 'assets/assets/logo.png',
    });
  });
});
