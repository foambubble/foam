import { generateLinkReferences } from '.';
import { TEST_DATA_DIR } from '../../test/test-utils';
import { MarkdownResourceProvider } from '../markdown-provider';
import { bootstrap } from '../model/foam';
import { Resource } from '../model/note';
import { Range } from '../model/range';
import { FoamWorkspace } from '../model/workspace';
import { FileDataStore, Matcher } from '../services/datastore';
import { Logger } from '../utils/log';

Logger.setLevel('error');

describe('generateLinkReferences', () => {
  let _workspace: FoamWorkspace;
  // TODO slug must be reserved for actual slugs, not file names
  const findBySlug = (slug: string): Resource => {
    return _workspace
      .list()
      .find(res => res.uri.getName() === slug) as Resource;
  };

  beforeAll(async () => {
    const matcher = new Matcher([TEST_DATA_DIR.joinPath('__scaffold__')]);
    const mdProvider = new MarkdownResourceProvider(matcher);
    const foam = await bootstrap(matcher, new FileDataStore(), [mdProvider]);
    _workspace = foam.workspace;
  });

  it('initialised test graph correctly', () => {
    expect(_workspace.list().length).toEqual(10);
  });

  it('should add link references to a file that does not have them', () => {
    const note = findBySlug('index');
    const expected = {
      newText: textForNote(
        note,
        `
[//begin]: # "Autogenerated link references for markdown compatibility"
[first-document]: first-document "First Document"
[second-document]: second-document "Second Document"
[file-without-title]: file-without-title "file-without-title"
[//end]: # "Autogenerated link references"`
      ),
      range: Range.create(9, 0, 9, 0),
    };

    const actual = generateLinkReferences(note, _workspace, false);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should remove link definitions from a file that has them, if no links are present', () => {
    const note = findBySlug('second-document');

    const expected = {
      newText: '',
      range: Range.create(6, 0, 8, 42),
    };

    const actual = generateLinkReferences(note, _workspace, false);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should update link definitions if they are present but changed', () => {
    const note = findBySlug('first-document');

    const expected = {
      newText: textForNote(
        note,
        `[//begin]: # "Autogenerated link references for markdown compatibility"
[file-without-title]: file-without-title "file-without-title"
[//end]: # "Autogenerated link references"`
      ),
      range: Range.create(8, 0, 10, 42),
    };

    const actual = generateLinkReferences(note, _workspace, false);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should not cause any changes if link reference definitions were up to date', () => {
    const note = findBySlug('third-document');

    const expected = null;

    const actual = generateLinkReferences(note, _workspace, false);

    expect(actual).toEqual(expected);
  });

  it('should put links with spaces in angel brackets', () => {
    const note = findBySlug('angel-reference');
    const expected = {
      newText: textForNote(
        note,
        `
[//begin]: # "Autogenerated link references for markdown compatibility"
[Note being refered as angel]: <Note being refered as angel> "Note being refered as angel"
[//end]: # "Autogenerated link references"`
      ),
      range: Range.create(3, 0, 3, 0),
    };

    const actual = generateLinkReferences(note, _workspace, false);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should not remove explicitly entered link references', () => {
    const note = findBySlug('file-with-explicit-link-references');
    const expected = null;

    const actual = generateLinkReferences(note, _workspace, false);

    expect(actual).toEqual(expected);
  });

  it('should not remove explicitly entered link references and have an implicit link', () => {
    const note = findBySlug('file-with-explicit-and-implicit-link-references');
    const expected = {
      newText: textForNote(
        note,
        `[^footerlink]: https://foambubble.github.io/
[linkrefenrece]: https://foambubble.github.io/
[//begin]: # "Autogenerated link references for markdown compatibility"
[first-document]: first-document "First Document"
[//end]: # "Autogenerated link references"`
      ),
      range: Range.create(5, 0, 10, 42),
    };

    const actual = generateLinkReferences(note, _workspace, false);

    expect(actual).toEqual(expected);
  });
});

/**
 * Will adjust a text line separator to match
 * what is used by the note
 * Necessary when running tests on windows
 *
 * @param note the note we are adjusting for
 * @param text starting text, using a \n line separator
 */
function textForNote(note: Resource, text: string): string {
  return text.split('\n').join(note.source.eol);
}
