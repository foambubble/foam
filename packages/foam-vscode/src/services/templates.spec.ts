import { workspace } from 'vscode';
import path from 'path';
import { isWindows } from '../utils';
import { URI } from '../core/model/uri';
import { fromVsCodeUri } from '../utils/vsc-utils';
import { determineDefaultFilepath } from '../services/templates';

describe('determineDefaultFilepath', () => {
  test('Absolute filepath metadata is unchanged', () => {
    const absolutePath = isWindows
      ? 'C:\\absolute_path\\journal\\My Note Title.md'
      : '/absolute_path/journal/My Note Title.md';

    const resolvedValues = new Map<string, string>();
    const templateMetadata = new Map<string, string>();
    templateMetadata.set('filepath', absolutePath);

    const resultFilepath = determineDefaultFilepath(
      resolvedValues,
      templateMetadata
    );

    expect(URI.toFsPath(resultFilepath)).toMatch(absolutePath);
  });

  test('Relative filepath metadata is appended to current directory', () => {
    const relativePath = isWindows
      ? 'journal\\My Note Title.md'
      : 'journal/My Note Title.md';

    const resolvedValues = new Map<string, string>();
    const templateMetadata = new Map<string, string>();
    templateMetadata.set('filepath', relativePath);

    const resultFilepath = determineDefaultFilepath(
      resolvedValues,
      templateMetadata
    );

    const expectedPath = path.join(
      URI.toFsPath(fromVsCodeUri(workspace.workspaceFolders[0].uri)),
      relativePath
    );

    expect(URI.toFsPath(resultFilepath)).toMatch(expectedPath);
  });
});
