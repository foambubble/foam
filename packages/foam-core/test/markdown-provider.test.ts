import {
  createMarkdownParser,
  createMarkdownReferences,
} from '../src/markdown-provider';
import { DirectLink } from '../src/model/note';
import { ParserPlugin } from '../src/plugins';
import { URI } from '../src/common/uri';
import { Logger } from '../src/utils/log';
import { uriToSlug } from '../src/utils';
import { FoamWorkspace } from '../src/model/workspace';

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
    const workspace = new FoamWorkspace();
    workspace.set(createNoteFromMarkdown('/page-a.md', pageA));
    workspace.set(createNoteFromMarkdown('/page-b.md', pageB));
    workspace.set(createNoteFromMarkdown('/page-c.md', pageC));
    workspace.set(createNoteFromMarkdown('/page-d.md', pageD));
    workspace.set(createNoteFromMarkdown('/page-e.md', pageE));

    expect(
      workspace
        .list()
        .map(n => n.uri)
        .map(uriToSlug)
        .sort()
    ).toEqual(['page-a', 'page-b', 'page-c', 'page-d', 'page-e']);
  });

  it('Ingores external links', () => {
    const note = createNoteFromMarkdown(
      '/path/to/page-a.md',
      `
this is a [link to google](https://www.google.com)
`
    );
    expect(note.links.length).toEqual(0);
  });

  it('Ignores references to sections in the same file', () => {
    const note = createNoteFromMarkdown(
      '/path/to/page-a.md',
      `
this is a [link to intro](#introduction)
`
    );
    expect(note.links.length).toEqual(0);
  });

  it('Parses internal links correctly', () => {
    const note = createNoteFromMarkdown(
      '/path/to/page-a.md',
      'this is a [link to page b](../doc/page-b.md)'
    );
    expect(note.links.length).toEqual(1);
    const link = note.links[0] as DirectLink;
    expect(link.type).toEqual('link');
    expect(link.label).toEqual('link to page b');
    expect(link.target).toEqual('../doc/page-b.md');
  });

  it('Parses links that have formatting in label', () => {
    const note = createNoteFromMarkdown(
      '/path/to/page-a.md',
      'this is [**link** with __formatting__](../doc/page-b.md)'
    );
    expect(note.links.length).toEqual(1);
    const link = note.links[0] as DirectLink;
    expect(link.type).toEqual('link');
    expect(link.label).toEqual('link with formatting');
    expect(link.target).toEqual('../doc/page-b.md');
  });

  it('Parses wikilinks correctly', () => {
    const workspace = new FoamWorkspace();
    const noteA = createNoteFromMarkdown('/page-a.md', pageA);
    const noteB = createNoteFromMarkdown('/page-b.md', pageB);
    const noteC = createNoteFromMarkdown('/page-c.md', pageC);
    const noteD = createNoteFromMarkdown('/Page D.md', pageD);
    const noteE = createNoteFromMarkdown('/page e.md', pageE);

    workspace
      .set(noteA)
      .set(noteB)
      .set(noteC)
      .set(noteD)
      .set(noteE)
      .resolveLinks();

    expect(workspace.getBacklinks(noteB.uri)).toEqual([noteA.uri]);
    expect(workspace.getLinks(noteA.uri)).toEqual([
      noteB.uri,
      noteC.uri,
      noteD.uri,
      noteE.uri,
    ]);
  });
});

describe('Note Title', () => {
  it('should initialize note title if heading exists', () => {
    const note = createNoteFromMarkdown(
      '/page-a.md',
      `
# Page A
this note has a title
    `
    );
    expect(note.title).toBe('Page A');
  });

  it('should default to file name if heading does not exist', () => {
    const note = createNoteFromMarkdown(
      '/page-d.md',
      `
This file has no heading.
      `
    );

    expect(note.title).toEqual('page-d');
  });

  it('should give precedence to frontmatter title over other headings', () => {
    const note = createNoteFromMarkdown(
      '/page-e.md',
      `
---
title: Note Title
date: 20-12-12
---

# Other Note Title
      `
    );

    expect(note.title).toBe('Note Title');
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
    const note = createNoteFromMarkdown(
      '/page-e.md',
      `
---
title: Note Title
date: 20-12-12
---

# Other Note Title`
    );

    expect(note.properties.title).toBe('Note Title');
    expect(note.properties.date).toBe('20-12-12');
  });

  it('should parse empty frontmatter', () => {
    const workspace = new FoamWorkspace();
    const note = createNoteFromMarkdown(
      '/page-f.md',
      `
---
---

# Empty Frontmatter
`
    );

    expect(note.properties).toEqual({});
  });

  it('should not fail when there are issues with parsing frontmatter', () => {
    const note = createNoteFromMarkdown(
      '/page-f.md',
      `
---
title: - one
 - two
 - #
---

`
    );

    expect(note.properties).toEqual({});
  });
});

describe('wikilinks definitions', () => {
  it('can generate links without file extension when includeExtension = false', () => {
    const workspace = new FoamWorkspace();
    const noteA = createNoteFromMarkdown('/dir1/page-a.md', pageA);
    workspace
      .set(noteA)
      .set(createNoteFromMarkdown('/dir1/page-b.md', pageB))
      .set(createNoteFromMarkdown('/dir1/page-c.md', pageC));

    const noExtRefs = createMarkdownReferences(workspace, noteA.uri, false);
    expect(noExtRefs.map(r => r.url)).toEqual(['page-b', 'page-c']);
  });

  it('can generate links with file extension when includeExtension = true', () => {
    const workspace = new FoamWorkspace();
    const noteA = createNoteFromMarkdown('/dir1/page-a.md', pageA);
    workspace
      .set(noteA)
      .set(createNoteFromMarkdown('/dir1/page-b.md', pageB))
      .set(createNoteFromMarkdown('/dir1/page-c.md', pageC));

    const extRefs = createMarkdownReferences(workspace, noteA.uri, true);
    expect(extRefs.map(r => r.url)).toEqual(['page-b.md', 'page-c.md']);
  });

  it('use relative paths', () => {
    const workspace = new FoamWorkspace();
    const noteA = createNoteFromMarkdown('/dir1/page-a.md', pageA);
    workspace
      .set(noteA)
      .set(createNoteFromMarkdown('/dir2/page-b.md', pageB))
      .set(createNoteFromMarkdown('/dir3/page-c.md', pageC));

    const extRefs = createMarkdownReferences(workspace, noteA.uri, true);
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

  it('can augment the parsing of the file', () => {
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
