import { workspace } from 'vscode';
import { getDailyNotePath } from './dated-notes';

describe('getDailyNotePath', () => {
  test('Adds the root directory to relative directories (Posix paths)', async () => {
    const date = new Date('2021-02-07T00:00:00Z');
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const isoDate = `${year}-0${month}-0${day}`;

    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', 'journal/subdir');
    const foamConfiguration = workspace.getConfiguration('foam');
    expect(getDailyNotePath(foamConfiguration, date).path).toMatch(
      new RegExp(`journal[\\\\/]subdir[\\\\/]${isoDate}.md$`)
    );
  });

  test('Uses absolute directories without modification (Posix paths)', async () => {
    const date = new Date('2021-02-07T00:00:00Z');
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const isoDate = `${year}-0${month}-0${day}`;

    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', '/absolute_path/journal');
    const foamConfiguration = workspace.getConfiguration('foam');
    expect(getDailyNotePath(foamConfiguration, date).path).toMatch(
      new RegExp(`^/absolute_path/journal/${isoDate}.md`)
    );
  });

  test('Adds the root directory to relative directories (Windows paths)', async () => {
    const date = new Date('2021-02-07T00:00:00Z');
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const isoDate = `${year}-0${month}-0${day}`;

    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', 'journal\\subdir');
    const foamConfiguration = workspace.getConfiguration('foam');
    expect(getDailyNotePath(foamConfiguration, date).path).toMatch(
      new RegExp(`journal[\\\\/]subdir[\\\\/]${isoDate}.md$`)
    );
  });

  test('Uses absolute directories without modification (Windows paths)', async () => {
    // While technically the test passes on all OS's, it's only because the test is overly loose.
    // On Posix systems, this test actually does modify the path, since Windows style paths are
    // considered to be relative paths. So while this test passes on Posix systems, it is not
    // because it treats it as an absolute path, but rather that the test doesn't check the same thing.
    // This was considered "good enough" instead of introducing a dependency like `skip-if` to skip the
    // test on Posix systems.
    const date = new Date('2021-02-07T00:00:00Z');
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const isoDate = `${year}-0${month}-0${day}`;

    await workspace
      .getConfiguration('foam')
      .update('openDailyNote.directory', 'C:\\absolute_path\\journal');
    const foamConfiguration = workspace.getConfiguration('foam');
    expect(getDailyNotePath(foamConfiguration, date).path).toMatch(
      new RegExp(`/C:[\\\\/]absolute_path[\\\\/]journal[\\\\/]${isoDate}.md`)
    );
  });
});
