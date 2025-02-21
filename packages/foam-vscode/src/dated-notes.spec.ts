import { workspace } from 'vscode';
import { createDailyNoteIfNotExists, getDailyNotePath } from './dated-notes';
import { isWindows } from './core/common/platform';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  deleteFile,
  showInEditor,
  withModifiedFoamConfiguration,
} from './test/test-utils-vscode';
import { fromVsCodeUri } from './utils/vsc-utils';
import { URI } from './core/model/uri';

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

    await withModifiedFoamConfiguration('openDailyNote.directory', config, () =>
      expect(getDailyNotePath(date)).toEqual(expectedPath.toFsPath())
    );
  });

  test('Uses absolute directories without modification', async () => {
    const config = isWindows
      ? 'C:\\absolute_path\\journal'
      : '/absolute_path/journal';
    const expectedPath = isWindows
      ? `${config}\\${isoDate}.md`
      : `${config}/${isoDate}.md`;

    await withModifiedFoamConfiguration('openDailyNote.directory', config, () =>
      expect(getDailyNotePath(date)).toMatch(expectedPath)
    );
  });
});

describe('Daily note template', () => {
  it('Uses the daily note variables in the template', async () => {
    const targetDate = new Date(2021, 8, 12);

    const template = await createFile(
      // eslint-disable-next-line no-template-curly-in-string
      'hello ${FOAM_DATE_MONTH_NAME} ${FOAM_DATE_DATE} hello',
      ['.foam', 'templates', 'daily-note.md']
    );

    const uri = getDailyNotePath(targetDate);

    await createDailyNoteIfNotExists(targetDate);

    const doc = await showInEditor(URI.file(uri));
    const content = doc.editor.document.getText();
    expect(content).toEqual('hello September 12 hello');

    await deleteFile(template.uri);
  });

  afterAll(async () => {
    await cleanWorkspace();
    await closeEditors();
  });
});
