import * as path from 'path';
import { NoteGraph } from '../../src/note-graph';
import { generateHeading } from '../../src/janitor';
import { initializeNoteGraph } from '../../src/initialize-note-graph';

describe('generateHeadings', () => {
  let _graph: NoteGraph;

  beforeAll(async () => {
    _graph = await initializeNoteGraph(path.join(__dirname, '../__scaffold__'));
  });

  it('should add heading to a file that does not have them', () => {
    const note = _graph.getNotes({ slug: 'file-without-title' })[0];
    const expected = {
      newText: `# File without Title

`,
      range: {
        start: {
          line: 1,
          column: 1,
          offset: 0,
        },
        end: {
          line: 1,
          column: 1,
          offset: 0,
        },
      },
    };

    const actual = generateHeading(note);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should not cause any changes to a file that has a heading', () => {
    const note = _graph.getNotes({ slug: 'index' })[0];
    expect(generateHeading(note)).toBeNull();
  });
});
