import { generateHeading } from '.';
import { createNoteFromMarkdown } from '../test/test-utils';
import { Logger } from '../core/utils/log';

Logger.setLevel('error');

describe('generateHeadings', () => {
  it('should not cause any changes to a file that has a heading', () => {
    const content = '# Index\n\nSome content.\n';
    const note = createNoteFromMarkdown('/index.md', content);

    const actual = generateHeading(note, content, '\n');

    expect(actual).toBeNull();
  });
});
