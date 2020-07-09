import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import visit, { CONTINUE, EXIT } from 'unist-util-visit';
import { Node, Parent } from 'unist';
import * as path from 'path';
import { BubbleLink, Bubble, Foam } from '../core';

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

export function createBubbleFromMarkdown(uri: string, markdown: string): Bubble {
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
  const links: BubbleLink[] = []
  visit(tree, node => {
    if (node.type === 'wikiLink') {
      links.push({
        from: id,
        to: node.value as string,
        text: node.value as string,
      });
    }
  });
  return new Bubble(id, title, links, uri, markdown)
}

interface MarkdownReference {
  linkText: string
  wikiLink: string
  pageTitle: string
}

export function createMarkdownReferences(foam: Foam, bubbleId: string): MarkdownReference[] {
  const source = foam.getBubble(bubbleId)
  return source.getForwardLinks()
    .map(link => {
      const target = foam.getBubble(link.to)
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

function dropExtension(path: string): string {
  const parts = path.split(".");
  parts.pop();
  return parts.join(".");
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


