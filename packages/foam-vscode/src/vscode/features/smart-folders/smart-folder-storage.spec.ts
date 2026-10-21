/* @unit-ready */
import { RelativePattern, workspace } from 'vscode';
import { QUERIES_DIR } from '@foam/core';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { SmartFolderStorage } from './smart-folder-storage';

describe('SmartFolderStorage', () => {
  it('searches only inside the queries folder, not the whole workspace (#1747)', async () => {
    const root = fromVsCodeUri(workspace.workspaceFolders[0].uri);
    const storage = new SmartFolderStorage(root);
    const findFiles = vi.spyOn(workspace, 'findFiles');
    try {
      await storage.start();
      const bases = findFiles.mock.calls.map(([include]) =>
        include instanceof RelativePattern ? include.baseUri.fsPath : include
      );
      expect(bases).toEqual([toVsCodeUri(root.joinPath(QUERIES_DIR)).fsPath]);
    } finally {
      findFiles.mockRestore();
      storage.dispose();
    }
  });
});
