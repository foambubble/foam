import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readFoamConfig } from './config';

function withTmpConfig(
  settings: Record<string, unknown>,
  fn: (dir: string) => void
) {
  const dir = mkdtempSync(path.join(tmpdir(), 'foam-config-test-'));
  try {
    fs.mkdirSync(path.join(dir, '.vscode'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.vscode', 'settings.json'),
      JSON.stringify(settings),
      'utf8'
    );
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('readFoamConfig', () => {
  it('returns defaults when .vscode/settings.json is absent', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'foam-config-test-'));
    try {
      const cfg = readFoamConfig(dir);
      expect(cfg.getFilesInclude()).toEqual(['**/*']);
      expect(cfg.getFilesExclude()).toEqual([]);
      expect(cfg.getDefaultNoteExtension()).toBe('.md');
      expect(cfg.getNotesExtensions()).toEqual(['.md']);
      expect(cfg.getDailyNoteDirectory()).toBeNull();
      expect(cfg.getDailyNoteTitleFormat()).toBeNull();
      expect(cfg.getTemplatesFolder()).toBe('.foam/templates');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns defaults when .vscode/settings.json is malformed JSON', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'foam-config-test-'));
    try {
      fs.mkdirSync(path.join(dir, '.vscode'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, '.vscode', 'settings.json'),
        '{ not valid json',
        'utf8'
      );
      const cfg = readFoamConfig(dir);
      expect(cfg.getDefaultNoteExtension()).toBe('.md');
      expect(cfg.getFilesInclude()).toEqual(['**/*']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads foam.files.defaultNoteExtension', () => {
    withTmpConfig({ 'foam.files.defaultNoteExtension': 'mdx' }, dir => {
      const cfg = readFoamConfig(dir);
      expect(cfg.getDefaultNoteExtension()).toBe('.mdx');
      expect(cfg.getNotesExtensions()).toEqual(['.mdx']);
    });
  });

  it('reads foam.files.notesExtensions as additional extensions alongside the default', () => {
    withTmpConfig(
      { 'foam.files.defaultNoteExtension': 'md', 'foam.files.notesExtensions': 'txt org' },
      dir => {
        const cfg = readFoamConfig(dir);
        expect(cfg.getNotesExtensions()).toEqual(
          expect.arrayContaining(['.md', '.txt', '.org'])
        );
        const exts = cfg.getNotesExtensions();
        expect(new Set(exts).size).toBe(exts.length);
      }
    );
  });

  it('reads foam.files.exclude', () => {
    withTmpConfig({ 'foam.files.exclude': ['draft/**', 'archive/**'] }, dir => {
      const cfg = readFoamConfig(dir);
      expect(cfg.getFilesExclude()).toContain('draft/**');
      expect(cfg.getFilesExclude()).toContain('archive/**');
    });
  });

  it('merges foam.files.ignore (deprecated) into filesExclude', () => {
    withTmpConfig({ 'foam.files.ignore': ['old/**'] }, dir => {
      expect(readFoamConfig(dir).getFilesExclude()).toContain('old/**');
    });
  });

  it('merges keys of files.exclude into filesExclude', () => {
    withTmpConfig(
      { 'files.exclude': { 'build/**': true, '.DS_Store': false } },
      dir => {
        const excl = readFoamConfig(dir).getFilesExclude();
        expect(excl).toContain('build/**');
        expect(excl).toContain('.DS_Store');
      }
    );
  });

  it('reads foam.files.include', () => {
    withTmpConfig({ 'foam.files.include': ['notes/**', 'journal/**'] }, dir => {
      expect(readFoamConfig(dir).getFilesInclude()).toEqual([
        'notes/**',
        'journal/**',
      ]);
    });
  });

  it('reads daily note settings', () => {
    withTmpConfig(
      {
        'foam.openDailyNote.directory': 'journals',
        'foam.openDailyNote.filenameFormat': 'YYYY-MM-DD',
      },
      dir => {
        const cfg = readFoamConfig(dir);
        expect(cfg.getDailyNoteDirectory()).toBe('journals');
        expect(cfg.getDailyNoteFilenameFormat()).toBe('YYYY-MM-DD');
      }
    );
  });

  it('reads templates folder', () => {
    withTmpConfig({ 'foam.templates.folder': 'my-templates' }, dir => {
      expect(readFoamConfig(dir).getTemplatesFolder()).toBe('my-templates');
    });
  });
});
