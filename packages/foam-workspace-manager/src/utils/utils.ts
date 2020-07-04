// @todo convert this to use ast parsing

// import unified from 'unified';
// import markdown from 'remark-parse';
// import wikiLinkPlugin from 'remark-wiki-link';
// let processor = unified()
//   .use(markdown, { gfm: true })
//   .use(wikiLinkPlugin);

import { findTopLevelHeading, findWikilinksInMarkdown } from './markdown-utils';

// @ts-expect-error
export function readWorkspaceFile(filename: string): string {
  throw new Error('Not implemented');
}

export function parseNoteTitleFromMarkdown(markdown: string): string | null {
  return findTopLevelHeading(markdown);
}

export function parseNoteLinksFromMarkdown(markdown: string): string[] {
  return findWikilinksInMarkdown(markdown);
}
