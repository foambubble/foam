import { wait, waitForExpect } from '../test/test-utils';
import {
  closeEditors,
  createFile,
  cleanWorkspace,
  readFile,
  renameFile,
  showInEditor,
  runCommand,
  deleteFile,
  getUriInWorkspace,
} from '../test/test-utils-vscode';
import { UPDATE_GRAPH_COMMAND_NAME } from './commands/update-graph';
import { getFoamVsCodeConfig } from '../services/config';
import * as vscode from 'vscode';

describe('Folder rename with link updates', () => {
  beforeAll(async () => {
    await closeEditors();
    await cleanWorkspace();
  });
  afterAll(closeEditors);

  describe('folder rename operations', () => {
    it('should update wikilinks when folder is renamed', async () => {
      // Create folder structure: folder-a/note1.md, note2.md, folder-b/note3.md
      const note1 = await createFile(
        `# Note 1\nContent of note 1`,
        ['folder-rename-test', 'folder-a', 'note1.md']
      );
      const note2 = await createFile(
        `# Note 2\nLink to [[note1]] from same folder`,
        ['folder-rename-test', 'folder-a', 'note2.md']
      );

      const note3 = await createFile(
        `# Note 3\nLink to [[folder-a/note1]] from different folder`,
        ['folder-rename-test', 'folder-b', 'note3.md']
      );

      // Wait for workspace to be updated
      await wait(1000);
      await runCommand(UPDATE_GRAPH_COMMAND_NAME);

      // Rename folder-a to renamed-folder
      const folderA = getUriInWorkspace('folder-rename-test', 'folder-a');
      const newFolderUri = getUriInWorkspace('folder-rename-test', 'renamed-folder');
      await renameFile(folderA, newFolderUri);

      await waitForExpect(async () => {
        // Check that note3 now links to the renamed folder
        const note3Content = await readFile(note3.uri);
        expect(note3Content.trim()).toEqual(
          `# Note 3\nLink to [[renamed-folder/note1]] from different folder`
        );
      });

      // Check that note2 still has correct relative link
      const note2NewUri = getUriInWorkspace('folder-rename-test', 'renamed-folder', 'note2.md');
      const note2Content = await readFile(note2NewUri);
      expect(note2Content.trim()).toEqual(
        `# Note 2\nLink to [[note1]] from same folder`
      );
    });

    it('should update markdown links when folder is renamed', async () => {
      // Create folder structure with markdown links
      const note4 = await createFile(
        `# Note 4\nContent of note 4`,
        ['folder-rename-test', 'folder-c', 'note4.md']
      );
      const note5 = await createFile(
        `# Note 5\nLink to [Note 4](folder-c/note4.md) with markdown syntax`,
        ['folder-rename-test', 'note5.md']
      );

      // Wait for workspace to be updated
      await wait(1000);
      await runCommand(UPDATE_GRAPH_COMMAND_NAME);

      // Rename folder-c to renamed-folder-c
      const folderC = getUriInWorkspace('folder-rename-test', 'folder-c');
      const newFolderUri = getUriInWorkspace('folder-rename-test', 'renamed-folder-c');
      await renameFile(folderC, newFolderUri);

      await waitForExpect(async () => {
        // Check that note5 now links to the renamed folder
        const note5Content = await readFile(note5.uri);
        expect(note5Content.trim()).toEqual(
          `# Note 5\nLink to [Note 4](renamed-folder-c/note4.md) with markdown syntax`
        );
      });
    });

    it('should handle relative links in moved files correctly', async () => {
      // Create folder structure with relative links
      const note6 = await createFile(
        `# Note 6\nLink to [external](../../external.md) file`,
        ['folder-rename-test', 'deep', 'folder-d', 'note6.md']
      );
      const externalNote = await createFile(
        `# External Note\nContent`,
        ['folder-rename-test', 'external.md']
      );

      // Wait for workspace to be updated
      await wait(1000);
      await runCommand(UPDATE_GRAPH_COMMAND_NAME);

      // Move folder-d up one level (from deep/folder-d to folder-d)
      const folderD = getUriInWorkspace('folder-rename-test', 'deep', 'folder-d');
      const newFolderUri = getUriInWorkspace('folder-rename-test', 'folder-d');
      await renameFile(folderD, newFolderUri);

      await waitForExpect(async () => {
        // Check that relative link is updated (should now be ../external.md)
        const note6Uri = getUriInWorkspace('folder-rename-test', 'folder-d', 'note6.md');
        const note6Content = await readFile(note6Uri);
        expect(note6Content.trim()).toEqual(
          `# Note 6\nLink to [external](../external.md) file`
        );
      });
    });

    it('should respect configuration settings', async () => {
      // Test with mode set to 'never'
      const originalConfig = getFoamVsCodeConfig('folderRename.updateLinks', 'confirm');
      
      try {
        // Set config to 'never'
        await vscode.workspace.getConfiguration('foam').update(
          'folderRename.updateLinks',
          'never',
          vscode.ConfigurationTarget.Workspace
        );

        const note7 = await createFile(
          `# Note 7\nContent`,
          ['folder-rename-test', 'folder-e', 'note7.md']
        );
        const note8 = await createFile(
          `# Note 8\nLink to [[folder-e/note7]]`,
          ['folder-rename-test', 'note8.md']
        );

        // Wait for workspace to be updated
        await wait(1000);
        await runCommand(UPDATE_GRAPH_COMMAND_NAME);

        // Rename folder-e
        const folderE = getUriInWorkspace('folder-rename-test', 'folder-e');
        const newFolderUri = getUriInWorkspace('folder-rename-test', 'renamed-folder-e');
        await renameFile(folderE, newFolderUri);

        await wait(1000); // Give time for any potential updates

        // Link should NOT be updated when mode is 'never'
        const note8Content = await readFile(note8.uri);
        expect(note8Content.trim()).toEqual(
          `# Note 8\nLink to [[folder-e/note7]]` // Should remain unchanged
        );

      } finally {
        // Restore original config
        await vscode.workspace.getConfiguration('foam').update(
          'folderRename.updateLinks',
          originalConfig,
          vscode.ConfigurationTarget.Workspace
        );
      }
    });
  });
});
