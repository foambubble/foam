import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import visit, { CONTINUE, EXIT } from 'unist-util-visit';
import { Node, Parent } from 'unist';
import * as path from 'path';
import { Note, NoteLink, NoteGraph } from './note-graph';
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
  const tree = parse(markdown);
  let title = id;
  visit(tree, node => {
    if (node.type === 'heading' && node.depth === 1) {
      title = ((node as Parent)!.children[0].value as string) || title;
    }
    return title === id ? CONTINUE : EXIT;
  });
  const links: NoteLink[] = [];
  visit(tree, node => {
    if (node.type === 'wikiLink') {
      links.push({
        to: node.value as string,
        text: node.value as string,
        position: node.position!
      });
    }
  });
  return new Note(id, title, links, uri, markdown);
}

interface MarkdownReference {
  linkText: string;
  wikiLink: string;
  pageTitle: string;
}

export function createMarkdownReferences(
  graph: NoteGraph,
  noteId: string,
  includeExtension: boolean,
): MarkdownReference[] {
  const source = graph.getNote(noteId);

  // Should never occur since we're already in a file,
  // but better safe than sorry.
  if (!source) {
    console.warn(
      `Note ${noteId} was not added to NoteGraph before attempting to generate markdown reference list`
    );
    return [];
  }

  return graph
    .getForwardLinks(noteId)
    .map(link => {
      const target = graph.getNote(link.to);

      // We are dropping links to non-existent notes here,
      // but int the future we may want to surface these too
      if (!target) {
        console.log(
          `Link '${link.to}' in '${noteId}' points to a non-existing note.`
        );
        return null;
      }

      const relativePath = path.relative(
        path.dirname(source.path),
        target.path
      );

      const pathToNote = includeExtension
        ? relativePath
        : dropExtension(relativePath)

      // [wiki-link-text]: path/to/file.md "Page title"
      return {
        linkText: link.to,
        wikiLink: pathToNote,
        pageTitle: target.title,
      };
    })
    .filter(Boolean)
    .sort() as MarkdownReference[];
}
