import { workspace } from 'vscode';
import {
  createDailyNoteIfNotExists,
  getDailyNotePath,
  getDailyNoteVariables,
} from './dated-notes';
import { URI } from './core/model/uri';
import { isWindows } from './utils';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from './test/test-utils-vscode';

describe('getDailyNotePath', () => {
  const date = new Date('2021-02-07T00:00:00Z');
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const isoDate = `${year}-0${month}-0${day}`;

  test('Adds the root directory to relative directories', async () => {
    const config = 'journal';

    const expectedPath = URI.joinPath(
      workspace.workspaceFolders[0].uri,
      config,
      `${isoDate}.md`
    );

    const oldValue = await workspace
      .getConfiguration('foam')
      .get('openDailyNote.directory');
    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', config);
    const foamConfiguration = workspace.getConfiguration('foam');

    expect(URI.toFsPath(getDailyNotePath(foamConfiguration, date))).toEqual(
      URI.toFsPath(expectedPath)
    );

    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', oldValue);
  });

  test('Uses absolute directories without modification', async () => {
    const config = isWindows
      ? 'c:\\absolute_path\\journal'
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

    expect(URI.toFsPath(getDailyNotePath(foamConfiguration, date))).toMatch(
      expectedPath
    );

    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', oldValue);
  });
});

describe('Daily note template', () => {
  it('Computes variables correctly based on the target day', () => {
    const targetDate = new Date(Date.UTC(2021, 8, 12));
    const map = getDailyNoteVariables(targetDate);
    expect(map.get('DAILY_NOTE_YEAR')).toEqual('2021');
    expect(map.get('DAILY_NOTE_YEAR_SHORT')).toEqual('21');
    expect(map.get('DAILY_NOTE_MONTH')).toEqual('09');
    expect(map.get('DAILY_NOTE_MONTH_NAME')).toEqual('September');
    expect(map.get('DAILY_NOTE_MONTH_NAME_SHORT')).toEqual('Sep');
    expect(map.get('DAILY_NOTE_DATE')).toEqual('12');
    expect(map.get('DAILY_NOTE_DAY_NAME')).toEqual('Sunday');
    expect(map.get('DAILY_NOTE_DAY_NAME_SHORT')).toEqual('Sun');
    expect(map.get('DAILY_NOTE_HOUR')).toEqual('00');
    expect(map.get('DAILY_NOTE_MINUTE')).toEqual('00');
    expect(map.get('DAILY_NOTE_SECOND')).toEqual('00');
  });

  it('Uses the daily note variables in the template', async () => {
    const targetDate = new Date(Date.UTC(2021, 8, 12));

    await createFile(
      'hello ${DAILY_NOTE_MONTH_NAME} ${DAILY_NOTE_DATE} hello',
      ['.foam', 'templates', 'daily-note.md']
    );

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
