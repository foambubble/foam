import { Uri, workspace } from 'vscode';
import { getDailyNotePath } from './dated-notes';
import { URI } from 'foam-core';
import { isWindows } from './utils';

describe('getDailyNotePath', () => {
  const date = new Date('2021-02-07T00:00:00Z');
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const isoDate = `${year}-0${month}-0${day}`;

  test('Adds the root directory to relative directories', async () => {
    const config = 'journal';

    const expectedPath = Uri.joinPath(
      workspace.workspaceFolders[0].uri,
      config,
      `${isoDate}.md`
    );

    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', config);
    const foamConfiguration = workspace.getConfiguration('foam');

    expect(URI.toFsPath(getDailyNotePath(foamConfiguration, date))).toEqual(
      expectedPath.fsPath
    );
  });

  test('Uses absolute directories without modification', async () => {
    const config = isWindows
      ? 'c:\\absolute_path\\journal'
      : '/absolute_path/journal';
    const expectedPath = isWindows
      ? `${config}\\${isoDate}.md`
      : `${config}/${isoDate}.md`;

    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', config);
    const foamConfiguration = workspace.getConfiguration('foam');

    expect(URI.toFsPath(getDailyNotePath(foamConfiguration, date))).toMatch(
      expectedPath
    );
  });
});
