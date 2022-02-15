import { workspace } from 'vscode';
import { createDailyNoteIfNotExists, getDailyNotePath } from './dated-notes';
import { isWindows } from './core/common/platform';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from './test/test-utils-vscode';
import { fromVsCodeUri } from './utils/vsc-utils';

describe('getDailyNotePath', () => {
  const date = new Date('2021-02-07T00:00:00Z');
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const isoDate = `${year}-0${month}-0${day}`;

  test('Adds the root directory to relative directories', async () => {
    const config = 'journal';

    const expectedPath = fromVsCodeUri(
      workspace.workspaceFolders[0].uri
    ).joinPath(config, `${isoDate}.md`);

    const oldValue = await workspace
      .getConfiguration('foam')
      .get('openDailyNote.directory');
    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', config);
    const foamConfiguration = workspace.getConfiguration('foam');

    expect(getDailyNotePath(foamConfiguration, date).toFsPath()).toEqual(
      expectedPath.toFsPath()
    );

    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', oldValue);
  });

  test('Uses absolute directories without modification', async () => {
    const config = isWindows
      ? 'C:\\absolute_path\\journal'
      : '/absolute_path/journal';
    const expectedPath = isWindows
      ? `${config}\\${isoDate}.md`
      : `${config}/${isoDate}.md`;

    const oldValue = await workspace
      .getConfiguration('foam')
      .get('openDailyNote.directory');

    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', config);
    const foamConfiguration = workspace.getConfiguration('foam');

    expect(getDailyNotePath(foamConfiguration, date).toFsPath()).toMatch(
      expectedPath
    );

    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', oldValue);
  });
});

describe('Daily note template', () => {
  it('Uses the daily note variables in the template', async () => {
    const targetDate = new Date(2021, 8, 12);

    // eslint-disable-next-line no-template-curly-in-string
    await createFile('hello ${FOAM_DATE_MONTH_NAME} ${FOAM_DATE_DATE} hello', [
      '.foam',
      'templates',
      'daily-note.md',
    ]);

    const config = workspace.getConfiguration('foam');
    const uri = getDailyNotePath(config, targetDate);

    await createDailyNoteIfNotExists(config, uri, targetDate);

    const doc = await showInEditor(uri);
    const content = doc.editor.document.getText();
    expect(content).toEqual('hello September 12 hello');
  });

  afterAll(async () => {
    await cleanWorkspace();
    await closeEditors();
  });
});
