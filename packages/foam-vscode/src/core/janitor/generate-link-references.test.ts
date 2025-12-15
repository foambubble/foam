import { generateLinkReferences } from '.';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
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

  interface TestCase {
    case: string;
    input: string;
    expected: string;
  }

  const testCases: TestCase[] = [
    {
      case: 'should add link references for wikilinks present in note',
      input: `
# Index
[[doc1]] [[doc2]] [[file-without-title]]
`,
      expected: `
# Index
[[doc1]] [[doc2]] [[file-without-title]]

[doc1]: doc1 "First"
[doc2]: doc2 "Second"
[file-without-title]: file-without-title "file-without-title"
`,
    },
    {
      case: '#1558 - should keep a blank line before link references',
      input: `
# Test

[[doc1]]

[[doc2]]



`,
      expected: `
# Test

[[doc1]]

[[doc2]]

[doc1]: doc1 "First"
[doc2]: doc2 "Second"
`,
    },
    {
      case: 'should remove obsolete link definitions',
      input: `
# Document
Some content here.
[doc1]: doc1 "First"
`,
      expected: `
# Document
Some content here.

`,
    },
    {
      case: 'should add and remove link definitions as needed',
      input: `
# First Document

Here's some [unrelated] content.

[unrelated]: http://unrelated.com 'This link should not be changed'

[[file-without-title]]

[doc2]: doc2 'Second Document'
`,
      expected: `
# First Document

Here's some [unrelated] content.

[unrelated]: http://unrelated.com 'This link should not be changed'

[[file-without-title]]



[file-without-title]: file-without-title "file-without-title"
`,
    },
    {
      case: 'should not change correct link references',
      input: `
# Third Document
All the link references are correct in this file.

[[doc1]]
[[doc2]]


[doc1]: doc1 "First"
[doc2]: doc2 "Second"
`,
      expected: `
# Third Document
All the link references are correct in this file.

[[doc1]]
[[doc2]]


[doc1]: doc1 "First"
[doc2]: doc2 "Second"
`,
    },
    {
      case: 'should put links with spaces in angel brackets',
      input: `
# Angel reference

[[Angel note]]
`,
      expected: `
# Angel reference

[[Angel note]]

[Angel note]: <Angel note> "Angel note"
`,
    },
    {
      case: 'should not remove explicitly entered link references',
      input: `
# File with explicit link references

A Bug [^footerlink]. Here is [Another link][linkreference]

[^footerlink]: https://foambubble.github.io/

[linkreference]: https://foambubble.github.io/
`,
      expected: `
# File with explicit link references

A Bug [^footerlink]. Here is [Another link][linkreference]

[^footerlink]: https://foambubble.github.io/

[linkreference]: https://foambubble.github.io/
`,
    },
    {
      case: 'should not change explicitly entered link references',
      input: `
# File with explicit link references

A Bug [^footerlink]. Here is [Another link][linkreference].
I also want a [[doc1]].

[^footerlink]: https://foambubble.github.io/

[linkreference]: https://foambubble.github.io/
`,
      expected: `
# File with explicit link references

A Bug [^footerlink]. Here is [Another link][linkreference].
I also want a [[doc1]].

[^footerlink]: https://foambubble.github.io/

[linkreference]: https://foambubble.github.io/

[doc1]: doc1 "First"
`,
    },
    {
      case: 'should handle empty file with no wikilinks and no definitions',
      input: `
# Empty Document

Just some text without any links.
`,
      expected: `
# Empty Document

Just some text without any links.
`,
    },
    {
      case: 'should handle wikilinks with aliases',
      input: `
# Document with aliases

[[doc1|Custom Alias]] and [[doc2|Another Alias]]
`,
      expected: `
# Document with aliases

[[doc1|Custom Alias]] and [[doc2|Another Alias]]

[doc1|Custom Alias]: doc1 "First"
[doc2|Another Alias]: doc2 "Second"
`,
    },
    {
      case: 'should generate only one definition for multiple references to the same link',
      input: `
# Multiple references

First mention: [[doc1]]
Second mention: [[doc1]]
Third mention: [[doc1]]
`,
      expected: `
# Multiple references

First mention: [[doc1]]
Second mention: [[doc1]]
Third mention: [[doc1]]

[doc1]: doc1 "First"
`,
    },
    {
      case: 'should handle link definitions in the middle of content',
      input: `
# Document

[[doc1]]

[doc1]: doc1 "First"

Some more content here.

[[doc2]]
`,
      expected: `
# Document

[[doc1]]

[doc1]: doc1 "First"

Some more content here.

[[doc2]]

[doc2]: doc2 "Second"
`,
    },
    {
      case: 'should handle orphaned wikilinks without corresponding notes',
      input: `
# Document with broken links

[[doc1]] [[nonexistent]] [[another-missing]]
`,
      expected: `
# Document with broken links

[[doc1]] [[nonexistent]] [[another-missing]]

[doc1]: doc1 "First"
`,
    },
    {
      case: 'should handle file with only blank lines at end',
      input: `

`,
      expected: `

`,
    },
    {
      case: 'should handle empty files',
      input: '',
      expected: '',
    },
    {
      case: 'should handle link definitions with different quote styles',
      input: `
# Mixed quotes

[[doc1]] [[doc2]]

[doc1]: doc1 'First'
[doc2]: doc2 "Second"
`,
      expected: `
# Mixed quotes

[[doc1]] [[doc2]]

[doc1]: doc1 'First'
[doc2]: doc2 "Second"
`,
    },
    // TODO
    //     {
    //       case: 'should append new link references to existing ones without blank lines',
    //       input: `
    // [[doc1]] [[doc2]]

    // [doc1]: doc1 "First"
    // `,
    //       expected: `
    // [[doc1]] [[doc2]]

    // [doc1]: doc1 "First"
    // [doc2]: doc2 "Second"
    // `,
    //     },
  ];

  testCases.forEach(testCase => {
    // eslint-disable-next-line jest/valid-title
    it(testCase.case, async () => {
      const workspace = createTestWorkspace([URI.file('/')]);
      const workspaceNotes = [
        { uri: '/doc1.md', title: 'First' },
        { uri: '/doc2.md', title: 'Second' },
        { uri: '/file-without-title.md', title: 'file-without-title' },
        { uri: '/Angel note.md', title: 'Angel note' },
      ];
      workspaceNotes.forEach(note => {
        workspace.set(createTestNote({ uri: note.uri, title: note.title }));
      });

      const noteText = testCase.input;
      const note = parser.parse(URI.file('/note.md'), textForNote(noteText));
      const actual = await generateLinkReferences(
        note,
        noteText,
        EOL,
        workspace,
        false
      );
      const updated = TextEdit.apply(noteText, actual);

      expect(updated).toBe(textForNote(testCase.expected));
    });
  });
});
