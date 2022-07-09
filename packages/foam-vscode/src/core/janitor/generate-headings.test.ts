import { generateHeading } from '.';
import { readFileFromFs, TEST_DATA_DIR } from '../../test/test-utils';
import { MarkdownResourceProvider } from '../services/markdown-provider';
import { bootstrap } from '../model/foam';
import { Resource } from '../model/note';
import { Range } from '../model/range';
import { FoamWorkspace } from '../model/workspace';
import { FileDataStore, Matcher } from '../services/datastore';
import { Logger } from '../utils/log';
import detectNewline from 'detect-newline';

Logger.setLevel('error');

describe('generateHeadings', () => {
  let _workspace: FoamWorkspace;
  const findBySlug = (slug: string): Resource => {
    return _workspace
      .list()
      .find(res => res.uri.getName() === slug) as Resource;
  };

  beforeAll(async () => {
    const matcher = new Matcher([TEST_DATA_DIR.joinPath('__scaffold__')]);
    const dataStore = new FileDataStore(readFileFromFs);
    const mdProvider = new MarkdownResourceProvider(matcher, dataStore);
    const foam = await bootstrap(matcher, dataStore, [mdProvider]);
    _workspace = foam.workspace;
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
