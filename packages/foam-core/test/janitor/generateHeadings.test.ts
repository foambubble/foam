import * as path from 'path';
import { NoteGraph, Note } from '../../src/note-graph';
import { generateHeading } from '../../src/janitor';
import { initializeNoteGraph } from '../../src/initialize-note-graph';

describe('generateHeadings', () => {
  let _graph: NoteGraph;

  beforeAll(async () => {
    _graph = await initializeNoteGraph(path.join(__dirname, '../__scaffold__'));
  });

  it('should add heading to a file that does not have them', () => {
    const note = _graph.getNote('file-without-title') as Note;

    const expected = {
      newText: `# File without Title

`,
      range: {
        start: {
          line: 0,
          column: 0,
          offset: 0,
        },
        end: {
          line: 0,
          column: 0,
          offset: 0,
        },
      },
    };

    const actual = generateHeading(note!);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should not cause any changes to a file that does heading', () => {
    const note = _graph.getNote('index') as Note;

    const expected = null;

    const actual = generateHeading(note!);

    expect(actual).toEqual(expected);
  });
});
