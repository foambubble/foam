/* @unit-ready */
import { workspace } from 'vscode';
import { QUERIES_DIR } from '@foam/core';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { foldersSearchedFor } from '../../../test/test-utils-vscode';
import { SmartFolderStorage } from './smart-folder-storage';

describe('SmartFolderStorage', () => {
  it('searches only inside the queries folder, not the whole workspace (#1747)', async () => {
    const root = fromVsCodeUri(workspace.workspaceFolders[0].uri);
    const storage = new SmartFolderStorage(root);
    try {
      const folders = await foldersSearchedFor('*.{yaml,yml}', () =>
        storage.start()
      );
      expect(folders).toEqual([toVsCodeUri(root.joinPath(QUERIES_DIR)).fsPath]);
    } finally {
      storage.dispose();
    }
  });
});
