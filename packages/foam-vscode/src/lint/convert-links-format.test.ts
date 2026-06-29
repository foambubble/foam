import { convertLinkFormat } from '.';
import {
  InMemoryDataStore,
  createNoteFromMarkdown,
  createTestWorkspace,
} from '../test/test-utils';
import { URI } from '@foam/core';
import { Logger } from '@foam/core';

Logger.setLevel('error');

const FILE_WITH_DIFFERENT_LINK_FORMATS = `# File with different link formats

markdown link [home page](https://foam.md/)

wikilink to file [[first-document]].

markdown format link to local [file](first-document.md)

embedded wikilink to file ![[second-document]].

wikilink to placeholder [[non-exist-file]]

in-note anchor [[file-with-different-link-formats#one section]]

alias to anchor [[file-with-different-link-formats#one section|another name]]

alias [[first-document|an alias]]

dupilcated wikilink to file [[first-document]]

# one section`;

describe('generateStdMdLink', () => {
  const makeWorkspace = () => {
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([URI.file('/')], dataStore);
    const notes = [
      [
        '/file-with-different-link-formats.md',
        FILE_WITH_DIFFERENT_LINK_FORMATS,
      ],
      ['/first-document.md', `# First Document`],
      ['/second-document.md', `# Second Document`],
    ] as const;
    for (const [uri, content] of notes) {
      dataStore.set(URI.file(uri), content);
      workspace.set(createNoteFromMarkdown(uri, content));
    }
    return workspace;
  };

  it('can generate markdown links correctly', () => {
    const workspace = makeWorkspace();
    const note = workspace.find(
      URI.file('/file-with-different-link-formats.md')
    )!;
    const actual = note.links
      .filter(link => link.type === 'wikilink')
      .map(link => convertLinkFormat(link, 'link', workspace, note));
    const expected: string[] = [
      '[first-document](first-document.md)',
      '[second-document](second-document.md)',
      '[[non-exist-file]]',
      '[#one section](<file-with-different-link-formats.md#one section>)',
      '[another name](<file-with-different-link-formats.md#one section>)',
      '[an alias](first-document.md)',
      '[first-document](first-document.md)',
    ];
    expect(actual.length).toEqual(expected.length);
    actual.forEach((linkReplace, index) => {
      expect(linkReplace.newText).toEqual(expected[index]);
    });
  });

  it('can generate wikilinks correctly', () => {
    const workspace = makeWorkspace();
    const note = workspace.find(
      URI.file('/file-with-different-link-formats.md')
    )!;
    const actual = note.links
      .filter(link => link.type === 'link')
      .map(link => convertLinkFormat(link, 'wikilink', workspace, note));
    const expected: string[] = ['[[first-document|file]]'];
    expect(actual.length).toEqual(expected.length);
    actual.forEach((linkReplace, index) => {
      expect(linkReplace.newText).toEqual(expected[index]);
    });
  });
});
