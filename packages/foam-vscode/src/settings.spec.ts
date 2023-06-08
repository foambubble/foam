import { getNotesExtensions } from './settings';
import { withModifiedFoamConfiguration } from './test/test-utils-vscode';

describe('Default note settings', () => {
  it('should default to md', async () => {
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
        expect(notesExtensions).toEqual(['.md', '.mdxx']);
      }
    );
  });
});
