import { generateHeading } from './generate-headings';
import { createNoteFromMarkdown } from '../../test/test-utils';
import { Logger } from '../utils/log';
import { Range } from '../model/range';

Logger.setLevel('error');

describe('generateHeadings', () => {
  it('should not cause any changes to a file that has a heading', () => {
    const content = '# Index\n\nSome content.\n';
    const note = createNoteFromMarkdown('/index.md', content);

    const actual = generateHeading(note, content, '\n');

    expect(actual).toBeNull();
  });

  it('inserts the heading after the frontmatter', () => {
    const content = '---\ntitle: A\n---\nText\n';
    const note = createNoteFromMarkdown('/note.md', content);

    const actual = generateHeading(note, content, '\n');

    expect(actual.range).toEqual(Range.create(3, 0, 3, 0));
  });

  it('inserts the heading after frontmatter that follows a blank line', () => {
    const content = '\n---\ntitle: A\n---\nText\n';
    const note = createNoteFromMarkdown('/note.md', content);

    const actual = generateHeading(note, content, '\n');

    expect(actual.range).toEqual(Range.create(4, 0, 4, 0));
  });

  it('inserts the heading at the top when a --- there is never closed', () => {
    const content = '---\nSome text\n';
    const note = createNoteFromMarkdown('/note.md', content);

    const actual = generateHeading(note, content, '\n');

    expect(actual.range).toEqual(Range.create(0, 0, 0, 0));
  });
});
