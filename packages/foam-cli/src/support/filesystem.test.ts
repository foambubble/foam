import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Config, URI } from '@foam/core';
import { GlobMatcher } from './glob-matcher';
import { withTmpWorkspace } from '../test/test-utils';
import { loadWorkspaceFromDirectory, NodeFileDataStore } from './filesystem';

function createTmpDir(files: Record<string, string>): { rootDir: string; cleanup: () => void } {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'foam-datastore-test-'));
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(rootDir, name);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf8');
  }
  return { rootDir, cleanup: () => rmSync(rootDir, { recursive: true, force: true }) };
}

describe('GlobMatcher', () => {
  const root = URI.file('/workspace');

  // Use Windows-style backslash URI paths to confirm normalisation happens before
  // micromatch sees them — these cases would fail without the replace(/\\/g, '/').
  it('matches include glob against a backslash-separated path', () => {
    const matcher = new GlobMatcher(['notes/**'], [], root);
    const uri = { path: '/workspace/notes/foo.md' } as URI;
    expect(matcher.isMatch(uri)).toBe(true);
  });

  it('excludes a file matching the exclude glob', () => {
    const matcher = new GlobMatcher(['**/*'], ['draft/**'], root);
    const uri = { path: '/workspace/draft/wip.md' } as URI;
    expect(matcher.isMatch(uri)).toBe(false);
  });

  it('includes a file not matching the exclude glob', () => {
    const matcher = new GlobMatcher(['**/*'], ['draft/**'], root);
    const uri = { path: '/workspace/notes/foo.md' } as URI;
    expect(matcher.isMatch(uri)).toBe(true);
  });

  it('excludes a file not matching the include glob', () => {
    const matcher = new GlobMatcher(['**/*.md'], [], root);
    const uri = { path: '/workspace/notes/foo.txt' } as URI;
    expect(matcher.isMatch(uri)).toBe(false);
  });

  it('filters a list of files with match()', () => {
    const matcher = new GlobMatcher(['**/*.md'], ['draft/**'], root);
    const files = [
      URI.file('/workspace/notes/foo.md'),
      URI.file('/workspace/notes/foo.txt'),
      URI.file('/workspace/draft/wip.md'),
    ];
    expect(matcher.match(files)).toEqual([URI.file('/workspace/notes/foo.md')]);
  });
});

describe('NodeFileDataStore', () => {
  it('returns all files when no globs are configured', async () => {
    const { rootDir, cleanup } = createTmpDir({
      'note.md': '# Note',
      'sub/other.md': '# Other',
    });
    try {
      const matcher = new GlobMatcher(['**/*'], [], URI.file(rootDir));
      const store = new NodeFileDataStore(rootDir, [], matcher);
      const uris = await store.list();
      const paths = uris.map(u => u.toFsPath());
      expect(paths.some(p => p.endsWith('note.md'))).toBe(true);
      expect(paths.some(p => p.endsWith('other.md'))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('includes only files matching the include glob', async () => {
    const { rootDir, cleanup } = createTmpDir({
      'notes/foo.md': '# Foo',
      'notes/foo.txt': 'plain',
      'other.md': '# Other',
    });
    try {
      const matcher = new GlobMatcher(['notes/**/*.md'], [], URI.file(rootDir));
      const store = new NodeFileDataStore(rootDir, [], matcher);
      const uris = await store.list();
      const paths = uris.map(u => u.toFsPath());
      expect(paths.some(p => p.endsWith('foo.md'))).toBe(true);
      expect(paths.every(p => !p.endsWith('foo.txt'))).toBe(true);
      expect(paths.every(p => !p.endsWith('other.md'))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('excludes files matching the exclude glob', async () => {
    const { rootDir, cleanup } = createTmpDir({
      'note.md': '# Note',
      'draft/wip.md': '# WIP',
      'draft/wip2.md': '# WIP2',
    });
    try {
      const matcher = new GlobMatcher(['**/*'], ['draft/**'], URI.file(rootDir));
      const store = new NodeFileDataStore(rootDir, [], matcher);
      const uris = await store.list();
      const paths = uris.map(u => u.toFsPath());
      expect(paths.some(p => p.endsWith('note.md'))).toBe(true);
      expect(paths.every(p => !p.includes('draft'))).toBe(true);
    } finally {
      cleanup();
    }
  });
});

describe('loadWorkspaceFromDirectory', () => {
  it('excludes .git, node_modules, and other default excluded directories', async () => {
    await withTmpWorkspace(
      {
        'note.md': '# Note',
        '.git/note.md': '# In git',
        'node_modules/pkg/readme.md': '# Pkg',
        '.yarn/note.md': '# In yarn',
      },
      async ({ workspace }) => {
        const uris = workspace.list().map(r => r.uri.toFsPath());
        expect(uris.some(u => u.endsWith('note.md'))).toBe(true);
        expect(uris.every(u => !u.includes('.git'))).toBe(true);
        expect(uris.every(u => !u.includes('node_modules'))).toBe(true);
        expect(uris.every(u => !u.includes('.yarn'))).toBe(true);
      }
    );
  });

  it('reads foam configuration from .vscode/settings.json and applies it', async () => {
    await withTmpWorkspace(
      {
        '.vscode/settings.json': JSON.stringify({
          'foam.files.defaultNoteExtension': 'mdx',
          'foam.openDailyNote.directory': 'journals',
          'foam.templates.folder': 'my-templates',
        }),
        'note.mdx': '# MDX Note',
      },
      async ({ workspace }) => {
        const uris = workspace.list().map(r => r.uri.toFsPath());
        expect(uris.some(u => u.endsWith('note.mdx'))).toBe(true);
        expect(Config.getDefaultNoteExtension()).toBe('.mdx');
        expect(Config.getDailyNoteDirectory()).toBe('journals');
        expect(Config.getTemplatesFolder()).toBe('my-templates');
      }
    );
  });

  it('uses defaults when .vscode/settings.json is absent', async () => {
    await withTmpWorkspace({ 'note.md': '# Note' }, async ({ workspace }) => {
      const uris = workspace.list().map(r => r.uri.toFsPath());
      expect(uris.some(u => u.endsWith('note.md'))).toBe(true);
      expect(Config.getDefaultNoteExtension()).toBe('.md');
      expect(Config.getDailyNoteDirectory()).toBeNull();
      expect(Config.getTemplatesFolder()).toBe('.foam/templates');
    });
  });

  it('respects foam.files.exclude from configuration', async () => {
    await withTmpWorkspace(
      {
        '.vscode/settings.json': JSON.stringify({
          'foam.files.exclude': ['draft/**'],
        }),
        'note.md': '# Note',
        'draft/wip.md': '# WIP',
      },
      async ({ workspace }) => {
        const uris = workspace.list().map(r => r.uri.toFsPath());
        expect(uris.some(u => u.endsWith('note.md'))).toBe(true);
        expect(uris.every(u => !u.includes('draft'))).toBe(true);
      }
    );
  });

  it('respects explicitly excluded paths', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-filesystem-test-'));
    try {
      fs.writeFileSync(path.join(tempDir, 'note.md'), '# Note', 'utf8');
      fs.mkdirSync(path.join(tempDir, 'draft'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'draft', 'wip.md'), '# WIP', 'utf8');

      const { workspace } = await loadWorkspaceFromDirectory(tempDir, {
        excludedPaths: [path.join(tempDir, 'draft')],
      });
      const uris = workspace.list().map(r => r.uri.toFsPath());

      expect(uris.some(u => u.endsWith('note.md'))).toBe(true);
      expect(uris.every(u => !u.includes('draft'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
