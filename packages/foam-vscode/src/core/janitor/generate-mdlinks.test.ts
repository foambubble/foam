import { generateMarkdownLinks } from './generate-mdlinks';
import { TEST_DATA_DIR } from '../../test/test-utils';
import { MarkdownResourceProvider } from '../services/markdown-provider';
import { Resource } from '../model/note';
import { FoamWorkspace } from '../model/workspace';
import { Logger } from '../utils/log';
import fs from 'fs';
import { URI } from '../model/uri';
import { createMarkdownParser } from '../services/markdown-parser';
import { FileDataStore } from '../../test/test-datastore';

Logger.setLevel('error');

describe('generateStdMdLink', () => {
  let _workspace: FoamWorkspace;
  // TODO slug must be reserved for actual slugs, not file names
  const findBySlug = (slug: string): Resource => {
    return _workspace
      .list()
      .find(res => res.uri.getName() === slug) as Resource;
  };

  beforeAll(async () => {
    /** Use fs for reading files in units where vscode.workspace is unavailable */
    const readFile = async (uri: URI) =>
      (await fs.promises.readFile(uri.toFsPath())).toString();
    const dataStore = new FileDataStore(
      readFile,
      TEST_DATA_DIR.joinPath('__scaffold__').toFsPath()
    );
    const parser = createMarkdownParser();
    const mdProvider = new MarkdownResourceProvider(dataStore, parser);
    _workspace = await FoamWorkspace.fromProviders([mdProvider], dataStore);
  });

  it('initialised test graph correctly', () => {
    expect(_workspace.list().length).toEqual(11);
  });

  it('can generate markdown links correctly', async () => {
    const note = findBySlug('file-with-different-link-formats');
    const actual = await generateMarkdownLinks(note, _workspace);
    const expected: string[] = [
      '[first-document](first-document.md "First Document")',
      '[second-document](second-document.md "Second Document")',
      '[#one section](<#one section> "File with different link formats")',
      '[another name](<#one section> "File with different link formats")',
      '[an alias](first-document.md "First Document")',
    ];
    expect(actual.length).toEqual(expected.length);
    const _ = actual.map((textReplace, index) => {
      expect(textReplace.to).toEqual(expected[index]);
    });
  });
});
