import {
  createMarkdownParser,
  createMarkdownReferences,
} from '../src/markdown-provider';
import { NoteGraph } from '../src/model/note-graph';
import { ParserPlugin } from '../src/plugins';
import { URI } from '../src/common/uri';
import { Logger } from '../src/utils/log';
import { uriToSlug } from '../src/utils';

Logger.setLevel('error');

const pageA = `
# Page A

## Section
- [[page-b]]
- [[page-c]]
- [[Page D]]
- [[page e]]
`;

const pageB = `
# Page B

This references [[page-a]]`;

const pageC = `
# Page C
`;

const pageD = `
# Page D
`;

const pageE = `
# Page E
`;

const createNoteFromMarkdown = (path: string, content: string) =>
  createMarkdownParser([]).parse(URI.file(path), content);

describe('Markdown loader', () => {
  it('Converts markdown to notes', () => {
    const graph = new NoteGraph();
    graph.setNote(createNoteFromMarkdown('/page-a.md', pageA));
    graph.setNote(createNoteFromMarkdown('/page-b.md', pageB));
    graph.setNote(createNoteFromMarkdown('/page-c.md', pageC));
    graph.setNote(createNoteFromMarkdown('/page-d.md', pageD));
    graph.setNote(createNoteFromMarkdown('/page-e.md', pageE));

    expect(
      graph
        .getNotes()
        .map(n => n.uri)
        .map(uriToSlug)
        .sort()
    ).toEqual(['page-a', 'page-b', 'page-c', 'page-d', 'page-e']);
  });

  it('Parses wikilinks correctly', () => {
    const graph = new NoteGraph();
    const noteA = graph.setNote(createNoteFromMarkdown('/page-a.md', pageA));
    const noteB = graph.setNote(createNoteFromMarkdown('/page-b.md', pageB));
    graph.setNote(createNoteFromMarkdown('/page-c.md', pageC));
    graph.setNote(createNoteFromMarkdown('/Page D.md', pageD));
    graph.setNote(createNoteFromMarkdown('/page e.md', pageE));

    expect(
      graph
        .getBacklinks(noteB.uri)
        .map(link => graph.getNote(link.from)!.uri)
        .map(uriToSlug)
    ).toEqual(['page-a']);
    expect(
      graph
        .getForwardLinks(noteA.uri)
        .map(link => graph.getNote(link.to)!.uri)
        .map(uriToSlug)
    ).toEqual(['page-b', 'page-c', 'page-d', 'page-e']);
  });
});

describe('Note Title', () => {
  it('should initialize note title if heading exists', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(createNoteFromMarkdown('/page-a.md', pageA));

    const pageANoteTitle = graph.getNote(note.uri)!.title;
    expect(pageANoteTitle).toBe('Page A');
  });

  it('should default to file name if heading does not exist', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(
      createNoteFromMarkdown(
        '/page-d.md',
        `
This file has no heading.
      `
      )
    );

    const pageANoteTitle = graph.getNote(note.uri)!.title;
    expect(pageANoteTitle).toEqual('page-d');
  });

  it('should give precedence to frontmatter title over other headings', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(
      createNoteFromMarkdown(
        '/page-e.md',
        `
---
title: Note Title
date: 20-12-12
---

# Other Note Title
      `
      )
    );

    const pageENoteTitle = graph.getNote(note.uri)!.title;
    expect(pageENoteTitle).toBe('Note Title');
  });

  it('should not break on empty titles (see #276)', () => {
    const note = createNoteFromMarkdown(
      '/Hello Page.md',
      `
#

this note has an empty title line
    `
    );
    expect(note.title).toEqual('Hello Page');
  });
});

describe('frontmatter', () => {
  it('should parse yaml frontmatter', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(
      createNoteFromMarkdown(
        '/page-e.md',
        `
---
title: Note Title
date: 20-12-12
---

# Other Note Title`
      )
    );

    const expected = {
      title: 'Note Title',
      date: '20-12-12',
    };

    const actual: any = graph.getNote(note.uri)!.properties;

    expect(actual.title).toBe(expected.title);
    expect(actual.date).toBe(expected.date);
  });

  it('should parse empty frontmatter', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(
      createNoteFromMarkdown(
        '/page-f.md',
        `
---
---

# Empty Frontmatter
`
      )
    );

    const expected = {};

    const actual = graph.getNote(note.uri)!.properties;

    expect(actual).toEqual(expected);
  });

  it('should not fail when there are issues with parsing frontmatter', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(
      createNoteFromMarkdown(
        '/page-f.md',
        `
---
title: - one
 - two
 - #
---

`
      )
    );

    const expected = {};

    const actual = graph.getNote(note.uri)!.properties;

    expect(actual).toEqual(expected);
  });
});

describe('wikilinks definitions', () => {
  it('can generate links without file extension when includeExtension = false', () => {
    const graph = new NoteGraph();
    const noteA = graph.setNote(
      createNoteFromMarkdown('/dir1/page-a.md', pageA)
    );
    graph.setNote(createNoteFromMarkdown('/dir1/page-b.md', pageB));
    graph.setNote(createNoteFromMarkdown('/dir1/page-c.md', pageC));

    const noExtRefs = createMarkdownReferences(graph, noteA.uri, false);
    expect(noExtRefs.map(r => r.url)).toEqual(['page-b', 'page-c']);
  });

  it('can generate links with file extension when includeExtension = true', () => {
    const graph = new NoteGraph();
    const noteA = graph.setNote(
      createNoteFromMarkdown('/dir1/page-a.md', pageA)
    );
    graph.setNote(createNoteFromMarkdown('/dir1/page-b.md', pageB));
    graph.setNote(createNoteFromMarkdown('/dir1/page-c.md', pageC));

    const extRefs = createMarkdownReferences(graph, noteA.uri, true);
    expect(extRefs.map(r => r.url)).toEqual(['page-b.md', 'page-c.md']);
  });

  it('use relative paths', () => {
    const graph = new NoteGraph();
    const noteA = graph.setNote(
      createNoteFromMarkdown('/dir1/page-a.md', pageA)
    );
    graph.setNote(createNoteFromMarkdown('/dir2/page-b.md', pageB));
    graph.setNote(createNoteFromMarkdown('/dir3/page-c.md', pageC));

    const extRefs = createMarkdownReferences(graph, noteA.uri, true);
    expect(extRefs.map(r => r.url)).toEqual([
      '../dir2/page-b.md',
      '../dir3/page-c.md',
    ]);
  });
});

describe('tags plugin', () => {
  it('can find tags in the text of the note', () => {
    const noteA = createNoteFromMarkdown(
      '/dir1/page-a.md',
      `
# this is a heading
this is some #text that includes #tags we #care-about.
    `
    );
    expect(noteA.tags).toEqual(new Set(['text', 'tags', 'care-about']));
  });

  it('can find tags as text in yaml', () => {
    const noteA = createNoteFromMarkdown(
      '/dir1/page-a.md',
      `
---
tags: hello, world  this_is_good
---
# this is a heading
this is some #text that includes #tags we #care-about.
    `
    );
    expect(noteA.tags).toEqual(
      new Set(['text', 'tags', 'care-about', 'hello', 'world', 'this_is_good'])
    );
  });

  it('can find tags as array in yaml', () => {
    const noteA = createNoteFromMarkdown(
      '/dir1/page-a.md',
      `
---
tags: [hello, world,  this_is_good]
---
# this is a heading
this is some #text that includes #tags we #care-about.
    `
    );
    expect(noteA.tags).toEqual(
      new Set(['text', 'tags', 'care-about', 'hello', 'world', 'this_is_good'])
    );
  });
});

describe('parser plugins', () => {
  const testPlugin: ParserPlugin = {
    visit: (node, note) => {
      if (node.type === 'heading') {
        note.properties.hasHeading = true;
      }
    },
  };
  const parser = createMarkdownParser([testPlugin]);

  it('can augment the parsing of the file', async () => {
    const note1 = parser.parse(
      URI.file('/path/to/a'),
      `
This is a test note without headings.
But with some content.
`
    );
    expect(note1.properties.hasHeading).toBeUndefined();

    const note2 = parser.parse(
      URI.file('/path/to/a'),
      `
# This is a note with header
and some content`
    );
    expect(note2.properties.hasHeading).toBeTruthy();
  });
});
