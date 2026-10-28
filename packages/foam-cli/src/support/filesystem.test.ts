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

describe('NodeFileDataStore keeps writes inside the workspace', () => {
  // The escape target is named after the temp workspace, so a run that does
  // escape can't leave a folder that a later run would trip over.
  const escapeTarget = (rootDir: string) =>
    path.join(rootDir, '..', `${path.basename(rootDir)}-escaped`);

  it('refuses to overwrite a note that is a symlink to a file outside the workspace', () =>
    withTmpWorkspace({}, async ({ rootDir, dataStore }) => {
      const outside = escapeTarget(rootDir);
      fs.mkdirSync(outside);
      try {
        fs.writeFileSync(path.join(outside, 'target.md'), '# Outside');
        fs.symlinkSync(path.join(outside, 'target.md'), path.join(rootDir, 'note.md'));

        await expect(
          dataStore.write(URI.file(path.join(rootDir, 'note.md')), '# Changed')
        ).rejects.toThrow('outside the workspace');
        expect(fs.readFileSync(path.join(outside, 'target.md'), 'utf8')).toBe('# Outside');
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    }));

  it('refuses to move a note into a folder that is a symlink out of the workspace', () =>
    withTmpWorkspace({ 'note.md': '# Note' }, async ({ rootDir, dataStore }) => {
      const outside = escapeTarget(rootDir);
      fs.mkdirSync(outside);
      try {
        fs.symlinkSync(outside, path.join(rootDir, 'linked'));

        await expect(
          dataStore.move(
            URI.file(path.join(rootDir, 'note.md')),
            URI.file(path.join(rootDir, 'linked', 'note.md'))
          )
        ).rejects.toThrow('outside the workspace');
        expect(fs.readdirSync(outside)).toEqual([]);
        expect(fs.existsSync(path.join(rootDir, 'note.md'))).toBe(true);
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    }));

  it('refuses to delete a note in a folder that is a symlink out of the workspace', () =>
    withTmpWorkspace({}, async ({ rootDir, dataStore }) => {
      const outside = escapeTarget(rootDir);
      fs.mkdirSync(outside);
      try {
        fs.writeFileSync(path.join(outside, 'note.md'), '# Outside');
        fs.symlinkSync(outside, path.join(rootDir, 'linked'));

        await expect(
          dataStore.delete(URI.file(path.join(rootDir, 'linked', 'note.md')))
        ).rejects.toThrow('outside the workspace');
        expect(fs.readdirSync(outside)).toEqual(['note.md']);
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    }));

  it('refuses to move a note out of a folder that is a symlink out of the workspace', () =>
    withTmpWorkspace({}, async ({ rootDir, dataStore }) => {
      const outside = escapeTarget(rootDir);
      fs.mkdirSync(outside);
      try {
        fs.writeFileSync(path.join(outside, 'note.md'), '# Outside');
        fs.symlinkSync(outside, path.join(rootDir, 'linked'));

        await expect(
          dataStore.move(
            URI.file(path.join(rootDir, 'linked', 'note.md')),
            URI.file(path.join(rootDir, '.foam', 'trash', 'note.md'))
          )
        ).rejects.toThrow('outside the workspace');
        expect(fs.readdirSync(outside)).toEqual(['note.md']);
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    }));

  it('deletes a note that is a symlink out of the workspace, leaving its target', () =>
    withTmpWorkspace({}, async ({ rootDir, dataStore }) => {
      const outside = escapeTarget(rootDir);
      fs.mkdirSync(outside);
      try {
        fs.writeFileSync(path.join(outside, 'target.md'), '# Outside');
        fs.symlinkSync(path.join(outside, 'target.md'), path.join(rootDir, 'note.md'));

        await dataStore.delete(URI.file(path.join(rootDir, 'note.md')));

        expect(fs.existsSync(path.join(rootDir, 'note.md'))).toBe(false);
        expect(fs.readFileSync(path.join(outside, 'target.md'), 'utf8')).toBe('# Outside');
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    }));

  it.skipIf(process.platform === 'win32')(
    'refuses a name with a backslash that a symlink places next to the workspace',
    () =>
      withTmpWorkspace({}, async ({ rootDir, dataStore }) => {
        const name = `${path.basename(rootDir)}\\planted.md`;
        const planted = path.join(rootDir, '..', name);
        try {
          fs.symlinkSync('..', path.join(rootDir, 'up'));

          await expect(
            dataStore.write(URI.file(rootDir).joinPath('up', name), '# Planted')
          ).rejects.toThrow('outside the workspace');
          expect(fs.existsSync(planted)).toBe(false);
        } finally {
          fs.rmSync(planted, { force: true });
        }
      })
  );

  it('moves a note that is a symlink out of the workspace, leaving its target', () =>
    withTmpWorkspace({}, async ({ rootDir, dataStore }) => {
      const outside = escapeTarget(rootDir);
      fs.mkdirSync(outside);
      try {
        fs.writeFileSync(path.join(outside, 'target.md'), '# Outside');
        fs.symlinkSync(path.join(outside, 'target.md'), path.join(rootDir, 'note.md'));

        await dataStore.move(
          URI.file(path.join(rootDir, 'note.md')),
          URI.file(path.join(rootDir, '.foam', 'trash', 'note.md'))
        );

        expect(fs.existsSync(path.join(rootDir, 'note.md'))).toBe(false);
        expect(fs.readlinkSync(path.join(rootDir, '.foam', 'trash', 'note.md'))).toBe(
          path.join(outside, 'target.md')
        );
        expect(fs.readdirSync(outside)).toEqual(['target.md']);
        expect(fs.readFileSync(path.join(outside, 'target.md'), 'utf8')).toBe('# Outside');
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    }));

  it('writes a path with .. after a symlink where its path says, inside the workspace', () =>
    withTmpWorkspace({}, async ({ rootDir, dataStore }) => {
      const outside = escapeTarget(rootDir);
      fs.mkdirSync(path.join(outside, 'inner'), { recursive: true });
      try {
        fs.symlinkSync(path.join(outside, 'inner'), path.join(rootDir, 'linked'));

        await dataStore.write(URI.file(`${rootDir}/linked/../planted.md`), '# Planted');

        expect(fs.existsSync(path.join(rootDir, 'planted.md'))).toBe(true);
        expect(fs.readdirSync(outside)).toEqual(['inner']);
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    }));

  it('writes through a symlink that stays inside the workspace', () =>
    withTmpWorkspace({}, async ({ rootDir, dataStore }) => {
      fs.mkdirSync(path.join(rootDir, 'diary'));
      fs.symlinkSync(path.join(rootDir, 'diary'), path.join(rootDir, 'journals'));

      await dataStore.write(URI.file(path.join(rootDir, 'journals', 'new', 'day.md')), '# Day');

      expect(fs.readFileSync(path.join(rootDir, 'diary', 'new', 'day.md'), 'utf8')).toBe('# Day');
    }));
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

  it('does not index templates as notes', async () => {
    await withTmpWorkspace(
      {
        'note.md': '# Note',
        '.foam/templates/new-note.md': '# ${FOAM_TITLE}',
      },
      async ({ workspace }) => {
        const uris = workspace.list().map(r => r.uri.toFsPath());
        expect(uris.some(u => u.endsWith('note.md'))).toBe(true);
        expect(uris.every(u => !u.includes('.foam'))).toBe(true);
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
        expect(Config.getLegacyDailyNoteSettings().directory).toBe('journals');
        expect(Config.getTemplatesFolder()).toBe('my-templates');
      }
    );
  });

  it('uses defaults when .vscode/settings.json is absent', async () => {
    await withTmpWorkspace({ 'note.md': '# Note' }, async ({ workspace }) => {
      const uris = workspace.list().map(r => r.uri.toFsPath());
      expect(uris.some(u => u.endsWith('note.md'))).toBe(true);
      expect(Config.getDefaultNoteExtension()).toBe('.md');
      expect(Config.getLegacyDailyNoteSettings()).toEqual({});
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
