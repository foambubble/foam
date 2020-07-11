import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import visit, { CONTINUE, EXIT } from 'unist-util-visit';
import { Node, Parent } from 'unist';
import * as path from 'path';
import { Link, Note, NoteGraph } from './core';
import { dropExtension } from './utils';

let processor: unified.Processor | null = null;

function parse(markdown: string): Node {
  processor =
    processor ||
    unified()
      .use(markdownParse, { gfm: true })
      .use(wikiLinkPlugin);
  return processor.parse(markdown);
}

export function createNoteFromMarkdown(uri: string, markdown: string): Note {
  const filename = path.basename(uri);
  const id = path.parse(filename).name;
  const tree = parse(markdown)
  let title = id
  visit(tree, node => {
    if (node.type === 'heading' && node.depth === 1) {
      title = ((node as Parent)!.children[0].value as string) || title;
    }
    return title === id ? CONTINUE : EXIT;
  })
  const links: Link[] = []
  visit(tree, node => {
    if (node.type === 'wikiLink') {
      links.push({
        from: id,
        to: node.value as string,
        text: node.value as string,
      });
    }
  });
  return new Note(id, title, links, uri, markdown)
}

interface MarkdownReference {
  linkText: string
  wikiLink: string
  pageTitle: string
}

export function createMarkdownReferences(notes: NoteGraph, noteId: string): MarkdownReference[] {
  const source = notes.getNote(noteId)
  return notes.getForwardLinks(noteId)
    .map(link => {
      const target = notes.getNote(link.to)
      const relativePath = path.relative(path.dirname(source.path), target.path);
      const relativePathWithoutExtension = dropExtension(relativePath);

      // [wiki-link-text]: wiki-link "Page title"
      return {
        linkText: link.to,
        wikiLink: relativePathWithoutExtension,
        pageTitle: target.title,
      }
    })
    .sort()
}
