import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Config } from '@foam/core';
import { withTmpWorkspace } from '../test/test-utils';
import { loadWorkspaceFromDirectory } from './filesystem';

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
