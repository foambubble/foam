import { Uri, workspace } from 'vscode';
import { getDailyNotePath } from './dated-notes';
import path from 'path';

describe('getDailyNotePath', () => {
  test('Adds the root directory to relative directories', async () => {
    const pathFraments = ['journal', 'subdir'];
    const date = new Date('2021-02-07T00:00:00Z');
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const isoDate = `${year}-0${month}-0${day}`;

    const expectedPath = Uri.joinPath(
      workspace.workspaceFolders[0].uri,
      ...pathFraments,
      `${isoDate}.md`
    );

    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', path.join(...pathFraments));
    const foamConfiguration = workspace.getConfiguration('foam');
    expect(getDailyNotePath(foamConfiguration, date).path).toEqual(
      expectedPath.fsPath
    );
  });

  test('Uses absolute directories without modification', async () => {
    const date = new Date('2021-02-07T00:00:00Z');
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const isoDate = `${year}-0${month}-0${day}`;
    const config = path.join('absolute_path', 'journal');
    const expectedPath = path.join(config, `${isoDate}.md`);

    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', config);
    const foamConfiguration = workspace.getConfiguration('foam');
    expect(getDailyNotePath(foamConfiguration, date).path).toMatch(
      expectedPath
    );
  });
});
