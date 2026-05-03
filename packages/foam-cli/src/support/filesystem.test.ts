import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { loadWorkspaceFromDirectory } from './filesystem';

describe('loadWorkspaceFromDirectory', () => {
  it('excludes .git, node_modules, and other default excluded directories', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'foam-filesystem-test-'));
    try {
      fs.writeFileSync(path.join(tempDir, 'note.md'), '# Note', 'utf8');
      fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, '.git', 'note.md'), '# In git', 'utf8');
      fs.mkdirSync(path.join(tempDir, 'node_modules', 'pkg'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'node_modules', 'pkg', 'readme.md'), '# Pkg', 'utf8');
      fs.mkdirSync(path.join(tempDir, '.yarn'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, '.yarn', 'note.md'), '# In yarn', 'utf8');

      const { workspace } = await loadWorkspaceFromDirectory(tempDir);
      const uris = workspace.list().map(r => r.uri.toFsPath());

      expect(uris.some(u => u.includes('note.md') && !u.includes('.git') && !u.includes('node_modules'))).toBe(true);
      expect(uris.every(u => !u.includes('.git'))).toBe(true);
      expect(uris.every(u => !u.includes('node_modules'))).toBe(true);
      expect(uris.every(u => !u.includes('.yarn'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // TODO: implement once a CLI configuration layer exists (see Known Issues in foam-cli-spec.md).
  // loadWorkspaceFromDirectory should read foam.* settings from .vscode/settings.json
  // (with optional .foam/config.json overrides) and apply them when loading the workspace.
  // At minimum the following should be covered:
  //   - foam.files.include / foam.files.exclude are used to build the file matcher
  //   - foam.openDailyNote.directory / filenameFormat are returned as config
  //   - foam.files.defaultNoteExtension is used as the default extension
  //   - foam.templates.directory is returned as config
  it.skip('reads foam configuration from .vscode/settings.json', async () => {});
  it.skip('reads foam configuration from .foam/config.json when present', async () => {});
  it.skip('respects foam.files.exclude from configuration (excludes matching paths from workspace)', async () => {});

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
