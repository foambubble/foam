/* @unit-ready */
import { Config } from '@foam/core';
import {
  withModifiedConfiguration,
  withModifiedFoamConfiguration,
} from '../test/test-utils-vscode';

describe('VsCodeFoamConfig — notes extensions', () => {
  it('defaults to .md', () => {
    expect(Config.getDefaultNoteExtension()).toEqual('.md');
    expect(Config.getNotesExtensions()).toEqual(['.md']);
  });

  it('always includes the default extension in the notes extensions list', async () => {
    await withModifiedFoamConfiguration(
      'files.defaultNoteExtension',
      'mdxx',
      async () => {
        expect(Config.getNotesExtensions()).toEqual(['.mdxx']);

        await withModifiedFoamConfiguration(
          'files.notesExtensions',
          'md markdown',
          async () => {
            expect(Config.getNotesExtensions()).toEqual(
              expect.arrayContaining(['.mdxx', '.md', '.markdown'])
            );
          }
        );
      }
    );
  });
});

describe('VsCodeFoamConfig — files include', () => {
  it('defaults to **/*', () => {
    expect(Config.getFilesInclude()).toEqual(['**/*']);
  });

  it('returns custom include patterns when configured', async () => {
    await withModifiedFoamConfiguration(
      'files.include',
      ['notes/**'],
      async () => {
        expect(Config.getFilesInclude()).toEqual(['notes/**']);
      }
    );
  });

  it('supports multiple include patterns', async () => {
    await withModifiedFoamConfiguration(
      'files.include',
      ['docs/**', 'notes/**', '**/*.md'],
      async () => {
        expect(Config.getFilesInclude()).toEqual([
          'docs/**',
          'notes/**',
          '**/*.md',
        ]);
      }
    );
  });

  it('expands alternate groups in include patterns', async () => {
    await withModifiedFoamConfiguration(
      'files.include',
      ['**/*.{md,mdx,markdown}'],
      async () => {
        const includes = Config.getFilesInclude();
        expect(includes).toEqual(
          expect.arrayContaining(['**/*.md', '**/*.mdx', '**/*.markdown'])
        );
        expect(includes.length).toBe(3);
      }
    );
  });

  it('returns empty array when configured with empty array', async () => {
    await withModifiedFoamConfiguration('files.include', [], async () => {
      expect(Config.getFilesInclude()).toEqual([]);
    });
  });
});

describe('VsCodeFoamConfig — files exclude', () => {
  it('includes VS Code files.watcherExclude keys', async () => {
    // If VS Code is not watching a folder, Foam should not process it either.
    await withModifiedConfiguration(
      'files.watcherExclude',
      { '**/my-huge-tree/**': true, '**/scratch/**': false },
      async () => {
        const excludes = Config.getFilesExclude();
        // Only truthy entries are excluded, matching VS Code's semantics.
        expect(excludes).toContain('**/my-huge-tree/**');
        expect(excludes).not.toContain('**/scratch/**');
      }
    );
  });
});
