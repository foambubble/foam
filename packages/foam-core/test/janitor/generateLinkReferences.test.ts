import * as path from 'path';
import { NoteGraph, Note } from '../../src/note-graph';
import { generateLinkReferences } from '../../src/janitor';
import { initializeNoteGraph } from '../../src/initialize-note-graph';

describe('generateLinkReferences', () => {
  let _graph: NoteGraph;

  beforeAll(async () => {
    _graph = await initializeNoteGraph(path.join(__dirname, '../__scaffold__'));
  });

  it('initialised test graph correctly', () => {
    expect(_graph.getNotes().length).toEqual(5);
  });

  it('should add link references to a file that does not have them', () => {
    const note = _graph.getNote('index') as Note;
    const expected = {
      newText: `
[first-document]: first-document "First Document"
[second-document]: second-document "Second Document"
[file-without-title]: file-without-title "file-without-title"`,
      range: {
        start: {
          line: 10,
          column: 1,
          offset: 140,
        },
        end: {
          line: 10,
          column: 1,
          offset: 140,
        },
      },
    };

    const actual = generateLinkReferences(note!, _graph);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should remove link definitions from a file that has them, if no links are present', () => {
    const note = _graph.getNote('second-document') as Note;

    const expected = {
      newText: '',
      range: {
        start: {
          line: 7,
          column: 1,
          offset: 105,
        },
        end: {
          line: 9,
          column: 43,
          offset: 269,
        },
      },
    };

    const actual = generateLinkReferences(note!, _graph);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should update link definitions if they are present but changed', () => {
    const note = _graph.getNote('first-document') as Note;

    const expected = {
      newText: `[file-without-title]: file-without-title "file-without-title"`,
      range: {
        start: {
          line: 5,
          column: 1,
          offset: 42,
        },
        end: {
          line: 7,
          column: 43,
          offset: 209,
        },
      },
    };

    const actual = generateLinkReferences(note!, _graph);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should not cause any changes if link reference definitions were up to date', () => {
    const note = _graph.getNote('third-document') as Note;

    const expected = null;

    const actual = generateLinkReferences(note!, _graph);

    expect(actual).toEqual(expected);
  });
});
