import unified from 'unified';
import markdownParse from 'remark-parse';
import markdownStringify from 'remark-stringify';
import wikiLinkPlugin from 'remark-wiki-link';
import frontmatterPlugin from 'remark-frontmatter';
import shortHash from 'short-hash';
import visit from 'unist-util-visit';
import { Node, Parent, Point, Position } from 'unist';
import GitHubSlugger from 'github-slugger';
let processor: unified.Processor | null = null;

let stringifier = unified()
  .use(markdownStringify)
  .use(wikiLinkPlugin);

function parse(markdown: string): Node {
  processor =
    processor ||
    unified()
      .use(markdownParse, { gfm: true })
      .use(frontmatterPlugin, ['yaml'])
      .use(wikiLinkPlugin);
  return processor.parse(markdown);
}

export interface FileBlock {
  text: string;
  type: string;
  hash?: string;
  sort: string;
  key: string;
  position: Position;
}

export function getFileBlocks(markdown: string): FileBlock[] {
  let tree = parse(markdown);
  let blocks: FileBlock[] = [];
  let order = 0;
  visit(tree, node => {
    const block = getFileBlockFromNode(node, ++order);
    if (block) {
      blocks.push(block);
    }
  });

  return blocks;
}

let previouslySeenListItemLine = -1;
function getFileBlockFromNode(node: Node, order: number): FileBlock | null {
  switch (node.type) {
    case 'heading': {
      const text = (node.children as any[])[0].value as string;
      return {
        text,
        key: new GitHubSlugger().slug(text),
        type: node.type,
        sort: order.toString().padStart(6, '0'),
        position: node.position!,
      };
    }

    case 'listItem': {
      // @todo unhack
      previouslySeenListItemLine = node.position!.start.line;
      return null;
    }

    case 'paragraph': {
      let text;
      let existingHash;
      let hashRegex = /\^(\w+)\s{0,}$/;

      try {
        text = stringifier!.stringify(node);
        let matches = hashRegex.exec(text);
        if (matches) {
          existingHash = matches[1];
        }
      } catch (e) {
        console.log('Stringify failed', e.message, e, node);
        return null;
      }


      
      const type = node.position!.start.line === previouslySeenListItemLine ? 'listItem' : 'paragraph';
      return {
        text,
        hash: existingHash,
        key: existingHash || shortHash(text),
        type,
        sort: order.toString().padStart(6, '0'),
        position: node.position!,
      };
    }
    default:
      return null;
  }
}
