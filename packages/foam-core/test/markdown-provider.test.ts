import {
  createNoteFromMarkdown,
  createMarkdownReferences,
} from '../src/markdown-provider';
import { NoteGraph } from '../src/note-graph';

const pageA = `
# Page A

## Section
- [[page-b]]
- [[page-c]]
`;

const pageB = `
# Page B

This references [[page-a]]`;

const pageC = `
# Page C
`;

const pageD = `
This file has no heading.
`;

const pageE = `
---
title: Note Title
date: 20-12-12
---

# Other Note Title
`;

const pageF = `
---
---

# Empty Frontmatter
`;

describe('Markdown loader', () => {
  it('Converts markdown to notes', () => {
    const graph = new NoteGraph();
    graph.setNote(createNoteFromMarkdown('/page-a.md', pageA, '\n'));
    graph.setNote(createNoteFromMarkdown('/page-b.md', pageB, '\n'));
    graph.setNote(createNoteFromMarkdown('/page-c.md', pageC, '\n'));

    expect(
      graph
        .getNotes()
        .map(n => n.slug)
        .sort()
    ).toEqual(['page-a', 'page-b', 'page-c']);
  });

  it('Parses wikilinks correctly', () => {
    const graph = new NoteGraph();
    const noteA = graph.setNote(
      createNoteFromMarkdown('/page-a.md', pageA, '\n')
    );
    const noteB = graph.setNote(
      createNoteFromMarkdown('/page-b.md', pageB, '\n')
    );
    graph.setNote(createNoteFromMarkdown('/page-c.md', pageC, '\n'));

    expect(
      graph.getBacklinks(noteB.id).map(link => graph.getNote(link.from)!.slug)
    ).toEqual(['page-a']);
    expect(
      graph.getForwardLinks(noteA.id).map(link => graph.getNote(link.to)!.slug)
    ).toEqual(['page-b', 'page-c']);
  });
});

describe('Note Title', () => {
  it('should initialize note title if heading exists', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(
      createNoteFromMarkdown('/page-a.md', pageA, '\n')
    );

    const pageANoteTitle = graph.getNote(note.id)!.title;
    expect(pageANoteTitle).toBe('Page A');
  });

  it('should not initialize note title if heading does not exist', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(
      createNoteFromMarkdown('/page-d.md', pageD, '\n')
    );

    const pageANoteTitle = graph.getNote(note.id)!.title;
    expect(pageANoteTitle).toBe(null);
  });

  it('should give precedence to frontmatter title over other headings', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(
      createNoteFromMarkdown('/page-e.md', pageE, '\n')
    );

    const pageENoteTitle = graph.getNote(note.id)!.title;
    expect(pageENoteTitle).toBe('Note Title');
  });
});

describe('frontmatter', () => {
  it('should parse yaml frontmatter', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(
      createNoteFromMarkdown('/page-e.md', pageE, '\n')
    );

    const expected = {
      title: 'Note Title',
      date: '20-12-12',
    };

    const actual: any = graph.getNote(note.id)!.properties;

    expect(actual.title).toBe(expected.title);
    expect(actual.date).toBe(expected.date);
  });

  it('should parse empty frontmatter', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(
      createNoteFromMarkdown('/page-f.md', pageF, '\n')
    );

    const expected = {};

    const actual = graph.getNote(note.id)!.properties;

    expect(actual).toEqual(expected);
  });
});

describe('wikilinks definitions', () => {
  it('can generate links without file extension when includeExtension = false', () => {
    const graph = new NoteGraph();
    const noteA = graph.setNote(
      createNoteFromMarkdown('/dir1/page-a.md', pageA, '\n')
    );
    graph.setNote(createNoteFromMarkdown('/dir1/page-b.md', pageB, '\n'));
    graph.setNote(createNoteFromMarkdown('/dir1/page-c.md', pageC, '\n'));

    const noExtRefs = createMarkdownReferences(graph, noteA.id, false);
    expect(noExtRefs.map(r => r.url)).toEqual(['page-b', 'page-c']);
  });

  it('can generate links with file extension when includeExtension = true', () => {
    const graph = new NoteGraph();
    const noteA = graph.setNote(
      createNoteFromMarkdown('/dir1/page-a.md', pageA, '\n')
    );
    graph.setNote(createNoteFromMarkdown('/dir1/page-b.md', pageB, '\n'));
    graph.setNote(createNoteFromMarkdown('/dir1/page-c.md', pageC, '\n'));

    const extRefs = createMarkdownReferences(graph, noteA.id, true);
    expect(extRefs.map(r => r.url)).toEqual(['page-b.md', 'page-c.md']);
  });

  it('use relative paths', () => {
    const graph = new NoteGraph();
    const noteA = graph.setNote(
      createNoteFromMarkdown('/dir1/page-a.md', pageA, '\n')
    );
    graph.setNote(createNoteFromMarkdown('/dir2/page-b.md', pageB, '\n'));
    graph.setNote(createNoteFromMarkdown('/dir3/page-c.md', pageC, '\n'));

    const extRefs = createMarkdownReferences(graph, noteA.id, true);
    expect(extRefs.map(r => r.url)).toEqual([
      '../dir2/page-b.md',
      '../dir3/page-c.md',
    ]);
  });
});
