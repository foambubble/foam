import { generateLinkReferences } from '.';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { Range } from '../model/range';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { EOL } from 'os';
import { createMarkdownParser } from '../services/markdown-parser';

Logger.setLevel('error');

describe('generateLinkReferences', () => {
  it('should add link references to a file that does not have them', async () => {
    const parser = createMarkdownParser();
    const workspace = createTestWorkspace([URI.file('/')]);
    workspace.set(
      createTestNote({ uri: '/first-document.md', title: 'First Document' })
    );
    workspace.set(
      createTestNote({ uri: '/second-document.md', title: 'Second Document' })
    );
    workspace.set(
      createTestNote({
        uri: '/file-without-title.md',
        title: 'file-without-title',
      })
    );
    const noteText = `# Index

This file is intentionally missing the link reference definitions

[[first-document]]

[[second-document]]

[[file-without-title]]
`;

    const note = parser.parse(URI.file('/note.md'), textForNote(noteText));

    const expected = {
      newText: textForNote(
        `
[first-document]: first-document "First Document"
[second-document]: second-document "Second Document"
[file-without-title]: file-without-title "file-without-title"`
      ),
      range: Range.create(9, 0, 9, 0),
    };

    const noteEol = EOL;
    const actual = await generateLinkReferences(
      note,
      noteText,
      noteEol,
      workspace,
      false
    );

    expect(actual![0].range.start).toEqual(expected.range.start);
    expect(actual![0].range.end).toEqual(expected.range.end);
    expect(actual![0].newText).toEqual(expected.newText);
  });

  it('should remove link definitions from a file that has them, if no links are present', async () => {
    const parser = createMarkdownParser();
    const workspace = createTestWorkspace([URI.file('/')]);
    workspace.set(
      createTestNote({ uri: '/first-document.md', title: 'First Document' })
    );
    const noteText = `# Second Document

This is just a link target for now.

We can use it for other things later if needed.

[first-document]: first-document 'First Document'
`;

    const note = parser.parse(URI.file('/note.md'), textForNote(noteText));

    const expected = {
      newText: '',
      range: Range.create(6, 0, 6, 49),
    };

    const actual = await generateLinkReferences(
      note,
      noteText,
      EOL,
      workspace,
      false
    );

    expect(actual.length).toBe(1);
    expect(actual[0]!.range.start).toEqual(expected.range.start);
    expect(actual[0]!.range.end).toEqual(expected.range.end);
    expect(actual[0]!.newText).toEqual(expected.newText);
  });

  it('should update link definitions if they are present but changed', async () => {
    const parser = createMarkdownParser();
    const workspace = createTestWorkspace([URI.file('/')]);
    workspace.set(
      createTestNote({ uri: '/second-document.md', title: 'Second Document' })
    );
    workspace.set(
      createTestNote({
        uri: '/file-without-title.md',
        title: 'file-without-title',
      })
    );
    const noteText = `# First Document

Here's some [unrelated] content.

[unrelated]: http://unrelated.com 'This link should not be changed'

[[file-without-title]]

[second-document]: second-document 'Second Document'
`;

    const note = parser.parse(URI.file('/note.md'), textForNote(noteText));

    const expected = [
      {
        newText: '',
        range: Range.create(8, 0, 8, 52),
      },
      {
        newText: textForNote(
          `\n[file-without-title]: file-without-title "file-without-title"`
        ),
        range: Range.create(9, 0, 9, 0),
      },
    ];

    const actual = await generateLinkReferences(
      note,
      noteText,
      EOL,
      workspace,
      false
    );

    expect(actual.length).toBe(2);
    expect(actual[0]!.range.start).toEqual(expected[0].range.start);
    expect(actual[0]!.range.end).toEqual(expected[0].range.end);
    expect(actual[0]!.newText).toEqual(expected[0].newText);
    expect(actual[1]!.range.start).toEqual(expected[1].range.start);
    expect(actual[1]!.range.end).toEqual(expected[1].range.end);
    expect(actual[1]!.newText).toEqual(expected[1].newText);
  });

  it('should not cause any changes if link reference definitions were up to date', async () => {
    const parser = createMarkdownParser();
    const workspace = createTestWorkspace([URI.file('/')])
      .set(
        createTestNote({ uri: '/first-document.md', title: 'First Document' })
      )
      .set(
        createTestNote({ uri: '/second-document.md', title: 'Second Document' })
      );
    const noteText = `# Third Document

All the link references are correct in this file.

[[first-document]]

[[second-document]]

[first-document]: first-document "First Document"
[second-document]: second-document "Second Document"
`;

    const note = parser.parse(URI.file('/note.md'), textForNote(noteText));

    const expected = [];

    const noteEol = EOL;
    const actual = await generateLinkReferences(
      note,
      noteText,
      noteEol,
      workspace,
      false
    );

    expect(actual).toEqual(expected);
  });

  it('should put links with spaces in angel brackets', async () => {
    const parser = createMarkdownParser();
    const workspace = createTestWorkspace([URI.file('/')]).set(
      createTestNote({
        uri: '/Note being referred as angel.md',
        title: 'Note being referred as angel',
      })
    );
    const noteText = `# Angel reference

[[Note being referred as angel]]
`;
    const note = parser.parse(URI.file('/note.md'), textForNote(noteText));

    const expected = {
      newText: textForNote(
        `
[Note being referred as angel]: <Note being referred as angel> "Note being referred as angel"`
      ),
      range: Range.create(3, 0, 3, 0),
    };

    const actual = await generateLinkReferences(
      note,
      noteText,
      EOL,
      workspace,
      false
    );

    expect(actual.length).toBe(1);
    expect(actual[0]!.range.start).toEqual(expected.range.start);
    expect(actual[0]!.range.end).toEqual(expected.range.end);
    expect(actual[0]!.newText).toEqual(expected.newText);
  });

  it('should not remove explicitly entered link references', async () => {
    const parser = createMarkdownParser();
    const workspace = createTestWorkspace([URI.file('/')]);
    workspace.set(
      createTestNote({ uri: '/second-document.md', title: 'Second Document' })
    );
    workspace.set(
      createTestNote({
        uri: '/file-without-title.md',
        title: 'file-without-title',
      })
    );
    const noteText = `# File with explicit link references

A Bug [^footerlink]. Here is [Another link][linkreference]

[^footerlink]: https://foambubble.github.io/

[linkreference]: https://foambubble.github.io/
`;

    const note = parser.parse(URI.file('/note.md'), textForNote(noteText));

    const expected = [];

    const actual = await generateLinkReferences(
      note,
      noteText,
      EOL,
      workspace,
      false
    );

    expect(actual).toEqual(expected);
  });

  it('should not remove explicitly entered link references and have an implicit link', async () => {
    const parser = createMarkdownParser();
    const workspace = createTestWorkspace([URI.file('/')]);
    workspace.set(
      createTestNote({ uri: '/second-document.md', title: 'Second Document' })
    );
    const noteText = `# File with explicit link references

A Bug [^footerlink]. Here is [Another link][linkreference].
I also want a [[first-document]].

[^footerlink]: https://foambubble.github.io/

[linkreference]: https://foambubble.github.io/
[first-document]: first-document 'First Document'
`;

    const note = parser.parse(URI.file('/note.md'), textForNote(noteText));

    const actual = await generateLinkReferences(
      note,
      noteText,
      EOL,
      workspace,
      false
    );

    expect(actual.length).toBe(0);
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
function textForNote(text: string): string {
  const eol = EOL;
  return text.split('\n').join(eol);
}
