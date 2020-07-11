import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import visit from 'unist-util-visit';
import { Node, Parent } from 'unist';

// @ts-expect-error
export function readWorkspaceFile(filename: string): string {
  throw new Error('Not implemented');
}

// pipeline cache
let processor: unified.Processor | null = null;

function parse(markdown: string): Node {
  processor =
    processor ||
    unified()
      .use(markdownParse, { gfm: true })
      .use(wikiLinkPlugin);
  return processor.parse(markdown);
}

export function parseNoteTitleFromMarkdown(markdown: string): string | null {
  let title: string | null = null;
  const tree = parse(markdown);
  visit(tree, node => {
    if (node.type === 'heading' && node.depth === 1) {
      title = ((node as Parent)!.children[0].value as string) || null;
    }
    return title === null;
  });
  return title;
}

export function parseNoteLinksFromMarkdown(markdown: string): string[] {
  let links: string[] = [];
  const tree = parse(markdown);
  visit(tree, node => {
    if (node.type === 'wikiLink') {
      links.push(node.value as string);
    }
  });
  return links;
}
