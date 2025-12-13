import { generateLinkReferences } from '.';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { Range } from '../model/range';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { EOL } from 'os';
import { createMarkdownParser } from '../services/markdown-parser';
import { TextEdit } from '../services/text-edit';

Logger.setLevel('error');

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

describe('generateLinkReferences', () => {
  const parser = createMarkdownParser();

  it('should add link references to a file that does not have them', async () => {
    const workspace = createTestWorkspace([URI.file('/')]);
    workspace.set(createTestNote({ uri: '/doc1.md', title: 'First' }));
    workspace.set(createTestNote({ uri: '/doc2.md', title: 'Second' }));
    workspace.set(
      createTestNote({
        uri: '/file-without-title.md',
        title: 'file-without-title',
      })
    );
    const noteText = `# Index
[[doc1]] [[doc2]] [[file-without-title]]
`;

    const note = parser.parse(URI.file('/note.md'), textForNote(noteText));
    const actual = await generateLinkReferences(
      note,
      noteText,
      EOL,
      workspace,
      false
    );
    const updated = TextEdit.apply(noteText, actual);

    expect(updated).toBe(
      textForNote(`# Index
[[doc1]] [[doc2]] [[file-without-title]]

[doc1]: doc1 "First"
[doc2]: doc2 "Second"
[file-without-title]: file-without-title "file-without-title"
`)
    );
  });

  it('#1558 - should add multiple link references without excessive blank lines', async () => {
    const workspace = createTestWorkspace([URI.file('/')]);
    workspace.set(createTestNote({ uri: '/Doc1.md', title: 'Doc1' }));
    workspace.set(createTestNote({ uri: '/Doc2.md', title: 'Doc2' }));

    const noteText = `# Test

[[Doc1]]

[[Doc2]]



`;

    const note = parser.parse(URI.file('/note.md'), textForNote(noteText));
    const actual = await generateLinkReferences(
      note,
      noteText,
      EOL,
      workspace,
      false
    );
    const updated = TextEdit.apply(noteText, actual);

    expect(updated).toBe(
      textForNote(`# Test

[[Doc1]]

[[Doc2]]

[Doc1]: Doc1 "Doc1"
[Doc2]: Doc2 "Doc2"
`)
    );
  });

  it('should remove link definitions for links not present in note', async () => {
    const workspace = createTestWorkspace([URI.file('/')]);
    workspace.set(createTestNote({ uri: '/doc1.md', title: 'First' }));
    const noteText = `# Document
Some content here.
[doc1]: doc1 'First Document'
`;

    const note = parser.parse(URI.file('/note.md'), textForNote(noteText));
    const actual = await generateLinkReferences(
      note,
      noteText,
      EOL,
      workspace,
      false
    );
    const updated = TextEdit.apply(noteText, actual);

    expect(updated).toBe(
      textForNote(`# Document
Some content here.

`)
    );
  });

  it('should add missing link definitions', async () => {
    const workspace = createTestWorkspace([URI.file('/')]);
    workspace.set(createTestNote({ uri: '/doc2.md', title: 'Second' }));
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

[doc2]: doc2 'Second Document'
`;

    const note = parser.parse(URI.file('/note.md'), textForNote(noteText));
    const actual = await generateLinkReferences(
      note,
      noteText,
      EOL,
      workspace,
      false
    );
    const updated = TextEdit.apply(noteText, actual);

    expect(updated).toBe(
      textForNote(`# First Document

Here's some [unrelated] content.

[unrelated]: http://unrelated.com 'This link should not be changed'

[[file-without-title]]



[file-without-title]: file-without-title "file-without-title"
`)
    );
  });

  it('should not cause any changes if link reference definitions were up to date', async () => {
    const workspace = createTestWorkspace([URI.file('/')])
      .set(createTestNote({ uri: '/doc1.md', title: 'First' }))
      .set(createTestNote({ uri: '/doc2.md', title: 'Second' }));
    const noteText = `# Third Document
All the link references are correct in this file.

[[doc1]]
[[doc2]]


[doc1]: doc1 "First"
[doc2]: doc2 "Second"
`;

    const note = parser.parse(URI.file('/note.md'), textForNote(noteText));
    const actual = await generateLinkReferences(
      note,
      noteText,
      EOL,
      workspace,
      false
    );
    const updated = TextEdit.apply(noteText, actual);

    expect(actual).toEqual([]);
    expect(updated).toEqual(noteText);
  });

  it('should put links with spaces in angel brackets', async () => {
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
    const actual = await generateLinkReferences(
      note,
      noteText,
      EOL,
      workspace,
      false
    );
    const updated = TextEdit.apply(noteText, actual);

    expect(updated).toBe(
      textForNote(`# Angel reference

[[Note being referred as angel]]

[Note being referred as angel]: <Note being referred as angel> "Note being referred as angel"
`)
    );
  });

  it('should not remove explicitly entered link references', async () => {
    const workspace = createTestWorkspace([URI.file('/')]);
    workspace.set(createTestNote({ uri: '/doc2.md', title: 'Second' }));
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

    const actual = await generateLinkReferences(
      note,
      noteText,
      EOL,
      workspace,
      false
    );

    expect(actual).toEqual([]);
  });

  it('should not remove explicitly entered link references and have an implicit link', async () => {
    const workspace = createTestWorkspace([URI.file('/')]);
    workspace.set(createTestNote({ uri: '/doc2.md', title: 'Second' }));
    const noteText = `# File with explicit link references

A Bug [^footerlink]. Here is [Another link][linkreference].
I also want a [[doc1]].

[^footerlink]: https://foambubble.github.io/

[linkreference]: https://foambubble.github.io/
[doc1]: doc1 'First Document'
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
