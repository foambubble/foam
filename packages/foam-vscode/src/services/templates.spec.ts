import { workspace } from 'vscode';
import path from 'path';
import { isWindows } from '../utils';
import { URI } from '../core/model/uri';
import { fromVsCodeUri } from '../utils/vsc-utils';
import { determineDefaultFilepath } from '../services/templates';

describe('Template', () => {
  it.todo('should support having metadata');
});

describe('Create note from template', () => {
  describe('User flow', () => {
    it.todo('should ask a user to confirm the path if note already exists');
    it.todo('should focus the editor on the newly created note');
  });

  it.todo('should expand variables when using a template');

  describe('Creation with active text selection', () => {
    it.todo('should populate FOAM_SELECTED_TEXT with the current selection');
    it.todo(
      'should open the newly created note in a new column if there was a selection'
    );
    it.todo(
      'should replace the original selection with a link to the newly created note'
    );
  });
});

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
