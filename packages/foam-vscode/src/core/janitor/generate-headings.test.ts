import { generateHeading } from '.';
import { readFileFromFs, TEST_DATA_DIR } from '../../test/test-utils';
import { MarkdownResourceProvider } from '../services/markdown-provider';
import { Resource } from '../model/note';
import { Range } from '../model/range';
import { FoamWorkspace } from '../model/workspace/foamWorkspace';
import { Logger } from '../utils/log';
import detectNewline from 'detect-newline';
import { createMarkdownParser } from '../services/markdown-parser';
import { FileDataStore } from '../../test/test-datastore';

Logger.setLevel('error');

describe('generateHeadings', () => {
  let _workspace: FoamWorkspace;
  const findBySlug = (slug: string): Resource => {
    return _workspace
      .list()
      .find(res => res.uri.getName() === slug) as Resource;
  };

  beforeAll(async () => {
    const dataStore = new FileDataStore(
      readFileFromFs,
      TEST_DATA_DIR.joinPath('__scaffold__').toFsPath()
    );
    const parser = createMarkdownParser();
    const mdProvider = new MarkdownResourceProvider(dataStore, parser);
    _workspace = await FoamWorkspace.fromProviders([mdProvider], dataStore);
  });

  it.skip('should add heading to a file that does not have them', async () => {
    const note = findBySlug('file-without-title');
    const expected = {
      newText: `# File without Title

`,
      range: Range.create(0, 0, 0, 0),
    };

    const noteText = await _workspace.readAsMarkdown(note.uri);
    const noteEol = detectNewline(noteText);
    const actual = await generateHeading(note, noteText, noteEol);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should not cause any changes to a file that has a heading', async () => {
    const note = findBySlug('index');
    const noteText = await _workspace.readAsMarkdown(note.uri);
    const noteEol = detectNewline(noteText);
    const actual = await generateHeading(note, noteText, noteEol);

    expect(actual).toBeNull();
  });

  it.skip('should generate heading when the file only contains frontmatter', async () => {
    const note = findBySlug('file-with-only-frontmatter');

    const expected = {
      newText: '\n# File with only Frontmatter\n\n',
      range: Range.create(3, 0, 3, 0),
    };

    const noteText = await _workspace.readAsMarkdown(note.uri);
    const noteEol = detectNewline(noteText);
    const actual = await generateHeading(note, noteText, noteEol);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });
});
