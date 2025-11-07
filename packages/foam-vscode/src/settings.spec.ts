/* @unit-ready */
import { getNotesExtensions, getIncludeFilesSetting } from './settings';
import { withModifiedFoamConfiguration } from './test/test-utils-vscode';

describe('Default note settings', () => {
  it('should default to .md', async () => {
    const config = getNotesExtensions();
    expect(config.defaultExtension).toEqual('.md');
    expect(config.notesExtensions).toEqual(['.md']);
  });

  it('should always include the default note extension in the list of notes extensions', async () => {
    withModifiedFoamConfiguration(
      'files.defaultNoteExtension',
      'mdxx',
      async () => {
        const { notesExtensions } = getNotesExtensions();
        expect(notesExtensions).toEqual(['.mdxx']);

        withModifiedFoamConfiguration(
          'files.notesExtensions',
          'md markdown',
          async () => {
            const { notesExtensions } = getNotesExtensions();
            expect(notesExtensions).toEqual(
              expect.arrayContaining(['.mdxx', '.md', '.markdown'])
            );
          }
        );
      }
    );
  });
});

describe('Include files settings', () => {
  it('should default to **/* when not configured', () => {
    const includes = getIncludeFilesSetting();
    expect(includes).toEqual(['**/*']);
  });

  it('should return custom include patterns when configured', async () => {
    withModifiedFoamConfiguration('files.include', ['notes/**'], async () => {
      const includes = getIncludeFilesSetting();
      expect(includes).toEqual(['notes/**']);
    });
  });

  it('should support multiple include patterns', async () => {
    withModifiedFoamConfiguration(
      'files.include',
      ['docs/**', 'notes/**', '**/*.md'],
      async () => {
        const includes = getIncludeFilesSetting();
        expect(includes).toEqual(['docs/**', 'notes/**', '**/*.md']);
      }
    );
  });

  it('should expand alternate groups in include patterns', async () => {
    withModifiedFoamConfiguration(
      'files.include',
      ['**/*.{md,mdx,markdown}'],
      async () => {
        const includes = getIncludeFilesSetting();
        expect(includes).toEqual(
          expect.arrayContaining(['**/*.md', '**/*.mdx', '**/*.markdown'])
        );
        expect(includes.length).toBe(3);
      }
    );
  });

  it('should return empty array when configured with empty array', async () => {
    withModifiedFoamConfiguration('files.include', [], async () => {
      const includes = getIncludeFilesSetting();
      expect(includes).toEqual([]);
    });
  });
});
