// eslint-disable-next-line import/no-extraneous-dependencies
import { Point, Node, Position as AstPosition, Parent } from 'unist';
import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import frontmatterPlugin from 'remark-frontmatter';
import { parse as parseYAML } from 'yaml';
import visit from 'unist-util-visit';
import { visitParents } from 'unist-util-visit-parents';
import {
  NoteLinkDefinition,
  Resource,
  ResourceParser,
  Section,
} from '../model/note';
import { Position } from '../model/position';
import { Range } from '../model/range';
import { extractHashtags, extractTagsFromProp, hash, isSome } from '../utils';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { ICache } from '../utils/cache';
import GithubSlugger from 'github-slugger';

export interface ParserPlugin {
  name?: string;
  visit?: (
    node: Node,
    note: Resource,
    noteSource: string,
    index?: number,
    parent?: Parent,
    ancestors?: Node[]
  ) => void;
  onDidInitializeParser?: (parser: unified.Processor) => void;
  onWillParseMarkdown?: (markdown: string) => string;
  onWillVisitTree?: (tree: Node, note: Resource) => void;
  onDidVisitTree?: (tree: Node, note: Resource, noteSource: string) => void;
  onDidFindProperties?: (properties: any, note: Resource, node: Node) => void;
}

type Checksum = string;

export interface ParserCacheEntry {
  checksum: Checksum;
  resource: Resource;
}

/**
 * This caches the parsed markdown for a given URI.
 *
 * The URI identifies the resource that needs to be parsed,
 * the checksum identifies the text that needs to be parsed.
 *
 * If the URI and the Checksum have not changed, the cached resource is returned.
 */
export type ParserCache = ICache<URI, ParserCacheEntry>;

export function createMarkdownParser(
  extraPlugins: ParserPlugin[] = [],
  cache?: ParserCache
): ResourceParser {
  const parser = unified()
    .use(markdownParse, { gfm: true })
    .use(frontmatterPlugin, ['yaml'])
    .use(wikiLinkPlugin, { aliasDivider: '|' });

  const plugins = [
    titlePlugin,
    wikilinkPlugin,
    definitionsPlugin,
    tagsPlugin,
    aliasesPlugin,
    sectionsPlugin,
    createBlockIdPlugin(),
    ...extraPlugins,
  ];

  for (const plugin of plugins) {
    try {
      plugin.onDidInitializeParser?.(parser);
    } catch (e) {
      handleError(plugin, 'onDidInitializeParser', undefined, e);
    }
  }

  const actualParser: ResourceParser = {
    parse: (uri: URI, markdown: string): Resource => {
      Logger.debug('Parsing:', uri.toString());
      for (const plugin of plugins) {
        try {
          plugin.onWillParseMarkdown?.(markdown);
        } catch (e) {
          handleError(plugin, 'onWillParseMarkdown', uri, e);
        }
      }
      const tree = parser.parse(markdown);

      const note: Resource = {
        uri: uri,
        type: 'note',
        properties: {},
        title: '',
        sections: [],
        tags: [],
        aliases: [],
        links: [],
        definitions: [],
      };

      for (const plugin of plugins) {
        try {
          plugin.onWillVisitTree?.(tree, note);
        } catch (e) {
          handleError(plugin, 'onWillVisitTree', uri, e);
        }
      }
      visitParents(tree, (node, ancestors) => {
        const parent = ancestors[ancestors.length - 1] as Parent | undefined; // Get the direct parent and cast to Parent
        const index = parent ? parent.children.indexOf(node) : undefined; // Get the index

        if (node.type === 'yaml') {
          try {
            const yamlProperties = parseYAML((node as any).value) ?? {};
            note.properties = {
              ...note.properties,
              ...yamlProperties,
            };
            for (const plugin of plugins) {
              try {
                plugin.onDidFindProperties?.(yamlProperties, note, node);
              } catch (e) {
                handleError(plugin, 'onDidFindProperties', uri, e);
              }
            }
          } catch (e) {
            Logger.warn(`Error while parsing YAML for [${uri.toString()}]`, e);
          }
        }

        for (const plugin of plugins) {
          try {
            plugin.visit?.(node, note, markdown, index, parent, ancestors);
          } catch (e) {
            handleError(plugin, 'visit', uri, e);
          }
        }
      });
      for (const plugin of plugins) {
        try {
          plugin.onDidVisitTree?.(tree, note, markdown);
        } catch (e) {
          handleError(plugin, 'onDidVisitTree', uri, e);
        }
      }
      Logger.debug('Result:', note);
      return note;
    },
  };

  const cachedParser: ResourceParser = {
    parse: (uri: URI, markdown: string): Resource => {
      const actualChecksum = hash(markdown);
      if (cache.has(uri)) {
        const { checksum, resource } = cache.get(uri);
        if (actualChecksum === checksum) {
          return resource;
        }
      }
      const resource = actualParser.parse(uri, markdown);
      cache.set(uri, { checksum: actualChecksum, resource });
      return resource;
    },
  };

  return isSome(cache) ? cachedParser : actualParser;
}

/**
 * Traverses all the children of the given node, extracts
 * the text from them, and returns it concatenated.
 *
 * @param root the node from which to start collecting text
 */
const getTextFromChildren = (root: Node): string => {
  let text = '';
  visit(root, node => {
    if (
      node.type === 'text' ||
      node.type === 'wikiLink' ||
      node.type === 'code' ||
      node.type === 'html'
    ) {
      text = text + ((node as any).value || '');
    }
  });
  return text;
};

/**
 * A parser plugin that adds Obsidian-style block identifiers (`^block-id`) to sections.
 *
 * This plugin adheres to the following principles:
 * - Single-pass AST traversal with direct sibling analysis (using `unist-util-visit-parents`).
 * - Distinguishes between full-line and inline IDs.
 * - Applies the "Last One Wins" rule for multiple IDs on a line.
 * - Ensures WYSIWYL (What You See Is What You Link) for section labels.
 * - Prevents duplicate processing of nodes using a `processedNodes` Set.
 *
 * @returns A `ParserPlugin` that processes block identifiers.
 */
export const createBlockIdPlugin = (): ParserPlugin => {
  const processedNodes = new Set<Node>();
  const slugger = new GithubSlugger();

  // Extracts the LAST block ID from a string (without the ^)
  // Extracts the LAST block ID from a string (with the ^ prefix)
  const getLastBlockId = (text: string): string | undefined => {
    const matches = text.match(/(?:\s|^)(\^[\w.-]+)$/); // Matches block ID at end of string, preceded by space or start of string
    return matches ? matches[1] : undefined;
  };

  // Gets the raw text of a node from the source markdown
  const getNodeText = (node: Node, markdown: string): string => {
    return markdown.substring(
      node.position!.start.offset!,
      node.position!.end.offset!
    );
  };

  return {
    name: 'block-id',
    onWillVisitTree: () => {
      processedNodes.clear();
      slugger.reset();
    },
    visit: (node, note, markdown, index, parent, ancestors) => {
      Logger.debug(
        `Visiting node: Type=${node.type}, Text="${
          getNodeText(node, markdown).split('\n')[0]
        }..."`
      );
      // Check if this node or any of its ancestors have already been processed
      // This prevents child nodes from creating sections if a parent already has one.
      const isAlreadyProcessed =
        ancestors.some(ancestor => processedNodes.has(ancestor)) ||
        processedNodes.has(node);
      Logger.debug(`  isAlreadyProcessed: ${isAlreadyProcessed}`);
      if (isAlreadyProcessed || !parent || index === undefined) {
        Logger.debug(
          `  Skipping node: isAlreadyProcessed=${isAlreadyProcessed}, parent=${!!parent}, index=${index}`
        );
        return;
      }

      // NEW: Special Case for Full-Line Block IDs on Lists
      if (node.type === 'list') {
        const listText = getNodeText(node, markdown);
        const listLines = listText.split('\n');
        const lastLine = listLines[listLines.length - 1];
        const fullLineBlockId = getLastBlockId(lastLine.trim());

        if (fullLineBlockId) {
          Logger.debug(
            `  Full-line block ID found on list: ${fullLineBlockId}`
          );
          // Create section for the entire list
          const sectionLabel = listLines
            .slice(0, listLines.length - 1)
            .join('\n');
          const sectionId = fullLineBlockId.substring(1);

          const startPos = astPointToFoamPosition(node.position!.start);
          const endLine = startPos.line + listLines.length - 2; // -1 for 0-indexed, -1 to exclude ID line
          const endChar = listLines[listLines.length - 2].length; // Length of the line before the ID line

          const sectionRange = Range.create(
            startPos.line,
            startPos.character,
            endLine,
            endChar
          );

          note.sections.push({
            id: sectionId,
            blockId: fullLineBlockId,
            label: sectionLabel,
            range: sectionRange,
            isHeading: false,
          });

          // Mark the list node and all its children as processed
          processedNodes.add(node);
          visit(node, child => {
            processedNodes.add(child);
          });
          Logger.debug(
            `  Marked list and all children as processed for full-line ID.`
          );
          return visit.SKIP; // Stop further processing for this list
        }
      }

      let block: Node | undefined;
      let blockId: string | undefined;
      let idNode: Node | undefined; // The node containing the full-line ID, if applicable

      const nodeText = getNodeText(node, markdown);

      // Case 1: Full-Line Block ID (e.g., "^id" on its own line)
      // This must be checked before the inline ID case.
      if (node.type === 'paragraph' && index > 0) {
        const pText = nodeText.trim();
        const isFullLineIdParagraph = /^\s*(\^[\w.-]+\s*)+$/.test(pText);

        if (isFullLineIdParagraph) {
          Logger.debug(`  Is full-line ID paragraph: ${isFullLineIdParagraph}`);
          const fullLineBlockId = getLastBlockId(pText);
          Logger.debug(`  Full-line block ID found: ${fullLineBlockId}`);
          if (fullLineBlockId) {
            const previousSibling = parent.children[index - 1];
            Logger.debug(
              `  Previous sibling type: ${previousSibling.type}, text: "${
                getNodeText(previousSibling, markdown).split('\n')[0]
              }..."`
            );
            const textBetween = markdown.substring(
              previousSibling.position!.end.offset!,
              node.position!.start.offset!
            );
            const isSeparatedBySingleNewline =
              textBetween.trim().length === 0 &&
              (textBetween.match(/\n/g) || []).length === 1;
            Logger.debug(
              `  Is separated by single newline: ${isSeparatedBySingleNewline}`
            );
            Logger.debug(
              `  Previous sibling already processed: ${processedNodes.has(
                previousSibling
              )}`
            );

            // If it's a full-line ID paragraph and correctly separated, link it to the previous block
            if (
              isSeparatedBySingleNewline &&
              !processedNodes.has(previousSibling)
            ) {
              block = previousSibling;
              blockId = fullLineBlockId;
              idNode = node; // This paragraph is the ID node
              Logger.debug(
                `  Assigned block (full-line): Type=${block.type}, ID=${blockId}`
              );
            } else {
              // If it's a full-line ID paragraph but not correctly linked,
              // mark it as processed so it doesn't get picked up as an inline ID later.
              processedNodes.add(node);
              Logger.debug(
                `  Marked ID node as processed (not correctly linked): ${node.type}`
              );
              return; // Skip further processing for this node
            }
          }
        }
      }

      // If no full-line block ID was found for a previous sibling, check for an inline block ID on the current node
      if (!block) {
        const inlineBlockId = getLastBlockId(nodeText);
        Logger.debug(`  Inline block ID found: ${inlineBlockId}`);
        if (inlineBlockId) {
          // If the node is a paragraph and its parent is a listItem, the block is the listItem.
          // This is only true if the paragraph is the *first* child of the listItem.
          if (node.type === 'paragraph' && parent.type === 'listItem') {
            if (parent.children[0] === node) {
              Logger.debug(
                `  Node is paragraph, parent is listItem, and it's the first child. Marking parent as processed: ${parent.type}`
              );
              // Mark the parent listItem as processed.
              // This prevents its children from being processed as separate sections.
              processedNodes.add(parent);
              block = parent;
            } else {
              // If it's a paragraph in a listItem but not the first child,
              // then the ID belongs to the paragraph itself, not the listItem.
              block = node;
            }
          } else {
            block = node;
          }
          blockId = inlineBlockId;
          Logger.debug(
            `  Assigned block (inline): Type=${block.type}, ID=${blockId}`
          );
        }
      }

      if (block && blockId) {
        let sectionLabel: string;
        let sectionRange: Range;
        let sectionId: string;
        let isHeading = false;

        Logger.debug('--- BLOCK ANALYSIS ---');
        Logger.debug('Block Type:', block.type);
        Logger.debug('Block Object:', JSON.stringify(block, null, 2));
        switch (block.type) {
          case 'heading':
            isHeading = true;
            sectionLabel = getTextFromChildren(block)
              .replace(/\s*\^[\w.-]+$/, '')
              .trim();
            sectionId = slugger.slug(sectionLabel);
            sectionRange = astPositionToFoamRange(block.position!);
            break;

          case 'listItem':
            // For list items, the label should include the leading marker and all content.
            // We need to get the full text of the listItem, including its children.
            sectionLabel = getNodeText(block, markdown);
            sectionId = blockId.substring(1); // ID without caret
            sectionRange = astPositionToFoamRange(block.position!);
            break;

          case 'list': {
            // For full-line IDs on lists, the parser includes the ID line in the node text, so we must remove it.
            const rawText = getNodeText(block, markdown);
            const lines = rawText.split('\n');
            lines.pop(); // Remove the last line which contains the ID
            sectionLabel = lines.join('\n');
            sectionId = blockId.substring(1);

            const startPos = astPointToFoamPosition(block.position!.start);
            const lastLine = lines[lines.length - 1];
            const endPos = Position.create(
              startPos.line + lines.length - 1,
              lastLine.length
            );
            sectionRange = Range.create(
              startPos.line,
              startPos.character,
              endPos.line,
              endPos.character
            );
            break;
          }

          case 'table':
          case 'code': {
            // For tables and code blocks, the label is the raw text content.
            // The range must be calculated from the text, as the parser's position can be inaccurate.
            Logger.debug(
              'Processing code/table block. Block position:',
              JSON.stringify(block.position)
            );
            sectionLabel = getNodeText(block, markdown);
            Logger.debug(
              'Section Label after getNodeText:',
              `"${sectionLabel}"`
            );
            sectionId = blockId.substring(1);
            const startPos = astPointToFoamPosition(block.position!.start);
            const lines = sectionLabel.split('\n');
            const endPos = Position.create(
              startPos.line + lines.length - 1,
              lines[lines.length - 1].length
            );
            sectionRange = Range.create(
              startPos.line,
              startPos.character,
              endPos.line,
              endPos.character
            );
            break;
          }

          case 'blockquote': {
            // For blockquotes, the parser includes the ID line in the node text, so we must remove it.
            const rawText = getNodeText(block, markdown);
            const lines = rawText.split('\n');
            lines.pop(); // Remove the last line which contains the ID
            sectionLabel = lines.join('\n');
            sectionId = blockId.substring(1);

            const startPos = astPointToFoamPosition(block.position!.start);
            const lastLine = lines[lines.length - 1];
            Logger.info('Blockquote last line:', `"${lastLine}"`);
            Logger.info('Blockquote last line length:', lastLine.length);
            const endPos = Position.create(
              startPos.line + lines.length - 1,
              lastLine.length - 1
            );
            sectionRange = Range.create(
              startPos.line,
              startPos.character,
              endPos.line,
              endPos.character
            );
            break;
          }

          case 'paragraph':
          default: {
            // For paragraphs, the label should include the inline block ID.
            sectionLabel = getNodeText(block, markdown);
            sectionId = blockId.substring(1);

            const startPos = astPointToFoamPosition(block.position!.start);
            const lines = sectionLabel.split('\n');
            const endPos = Position.create(
              startPos.line + lines.length - 1,
              lines[lines.length - 1].length
            );
            sectionRange = Range.create(
              startPos.line,
              startPos.character,
              endPos.line,
              endPos.character
            );
            break;
          }
        }

        note.sections.push({
          id: sectionId,
          blockId: blockId,
          label: sectionLabel,
          range: sectionRange,
          isHeading: isHeading,
        });

        // Mark the block and the ID node (if full-line) as processed
        processedNodes.add(block);
        Logger.debug(`  Marked block as processed: ${block.type}`);
        if (idNode) {
          processedNodes.add(idNode);
          Logger.debug(`  Marked ID node as processed: ${idNode.type}`);
        }

        // For list items, mark all children as processed to prevent duplicate sections
        if (block.type === 'listItem') {
          Logger.debug(
            `  Block is listItem. Marking all children as processed.`
          );
          visit(block, child => {
            processedNodes.add(child);
            Logger.debug(`    Marked child as processed: ${child.type}`);
          });
          Logger.debug(`  Returning visit.SKIP for listItem.`);
          return visit.SKIP; // Stop visiting children of this list item
        }
        Logger.debug(`  Returning visit.SKIP for current node.`);
        return visit.SKIP; // Skip further processing for this node
      }
    },
  };
};

/**
 * Traverses all the children of the given node, extracts
 * the text from them, and returns it concatenated.
 *
 * @param root the node from which to start collecting text
 */

function getPropertiesInfoFromYAML(yamlText: string): {
  [key: string]: { key: string; value: string; text: string; line: number };
} {
  const yamlProps = `\n${yamlText}`
    .split(/[\n](\w+:)/g)
    .filter(item => item.trim() !== '');
  const lines = yamlText.split('\n');
  let result: { line: number; key: string; text: string; value: string }[] = [];
  for (let i = 0; i < yamlProps.length / 2; i++) {
    const key = yamlProps[i * 2].replace(':', '');
    const value = yamlProps[i * 2 + 1].trim();
    const text = yamlProps[i * 2] + yamlProps[i * 2 + 1];
    result.push({ key, value, text, line: -1 });
  }
  result = result.map(p => {
    const line = lines.findIndex(l => l.startsWith(p.key + ':'));
    return { ...p, line };
  });
  return result.reduce((acc, curr) => {
    acc[curr.key] = curr;
    return acc;
  }, {} as { [key: string]: { key: string; value: string; text: string; line: number } });
}

const tagsPlugin: ParserPlugin = {
  name: 'tags',
  onDidFindProperties: (props, note, node) => {
    if (isSome(props.tags)) {
      const tagPropertyInfo = getPropertiesInfoFromYAML((node as any).value)[
        'tags'
      ];
      const tagPropertyStartLine =
        node.position!.start.line + tagPropertyInfo.line;
      const tagPropertyLines = tagPropertyInfo.text.split('\n');
      const yamlTags = extractTagsFromProp(props.tags);
      for (const tag of yamlTags) {
        const tagLine = tagPropertyLines.findIndex(l => l.includes(tag));
        const line = tagPropertyStartLine + tagLine;
        const charStart = tagPropertyLines[tagLine].indexOf(tag);
        note.tags.push({
          label: tag,
          range: Range.createFromPosition(
            Position.create(line, charStart),
            Position.create(line, charStart + tag.length)
          ),
        });
      }
    }
  },
  visit: (node, note) => {
    if (node.type === 'text') {
      const tags = extractHashtags((node as any).value);
      for (const tag of tags) {
        const start = astPointToFoamPosition(node.position!.start);
        start.character = start.character + tag.offset;
        const end: Position = {
          line: start.line,
          character: start.character + tag.label.length + 1,
        };
        note.tags.push({
          label: tag.label,
          range: Range.createFromPosition(start, end),
        });
      }
    }
  },
};

const sectionsPlugin: ParserPlugin = (() => {
  const slugger = new GithubSlugger();
  let sectionStack: Array<{
    label: string;
    level: number;
    start: Position;
  }> = [];

  return {
    name: 'section',
    onWillVisitTree: () => {
      sectionStack = [];
      slugger.reset(); // Reset slugger for each new tree traversal
    },
    visit: (node, note) => {
      if (node.type === 'heading') {
        const level = (node as any).depth;
        const label = getTextFromChildren(node);
        if (!label || !level) {
          return;
        }

        // Check if this heading has an inline block ID.
        // If it does, createBlockIdPlugin will handle it, so sectionsPlugin should skip.
        const inlineBlockIdRegex = /(?:^|\s)\^([\w-]+)\s*$/;
        if (label.match(inlineBlockIdRegex)) {
          return; // Skip if createBlockIdPlugin will handle this heading
        }

        const start = astPositionToFoamRange(node.position!).start;

        // Close all the sections that are not parents of the current section
        while (
          sectionStack.length > 0 &&
          sectionStack[sectionStack.length - 1].level >= level
        ) {
          const section = sectionStack.pop();
          note.sections.push({
            id: slugger.slug(section!.label),
            label: section!.label,
            range: Range.createFromPosition(section!.start, start),
            isHeading: true,
          });
        }

        // Add the new section to the stack
        sectionStack.push({ label, level, start });
      }
    },
    onDidVisitTree: (tree, note) => {
      const end = Position.create(
        astPointToFoamPosition(tree.position!.end).line + 1,
        0
      );
      // Close all the remaining sections
      while (sectionStack.length > 0) {
        const section = sectionStack.pop();
        note.sections.push({
          id: slugger.slug(section!.label),
          label: section!.label,
          range: { start: section!.start, end },
          isHeading: true,
        });
      }
      note.sections.sort((a, b) =>
        Position.compareTo(a.range.start, b.range.start)
      );
    },
  };
})();

const titlePlugin: ParserPlugin = {
  name: 'title',
  visit: (node, note) => {
    if (
      note.title === '' &&
      node.type === 'heading' &&
      (node as any).depth === 1
    ) {
      const title = getTextFromChildren(node);
      note.title = title.length > 0 ? title : note.title;
    }
  },
  onDidFindProperties: (props, note) => {
    // Give precedence to the title from the frontmatter if it exists
    note.title = props.title?.toString() ?? note.title;
  },
  onDidVisitTree: (tree, note) => {
    if (note.title === '') {
      note.title = note.uri.getName();
    }
  },
};

const aliasesPlugin: ParserPlugin = {
  name: 'aliases',
  onDidFindProperties: (props, note, node) => {
    if (isSome(props.alias)) {
      const aliases = Array.isArray(props.alias)
        ? props.alias
        : props.alias.split(',').map(m => m.trim());
      for (const alias of aliases) {
        note.aliases.push({
          title: alias,
          range: astPositionToFoamRange(node.position!),
        });
      }
    }
  },
};

const wikilinkPlugin: ParserPlugin = {
  name: 'wikilink',
  visit: (node, note, noteSource) => {
    if (node.type === 'wikiLink') {
      const isEmbed =
        noteSource.charAt(node.position!.start.offset - 1) === '!';

      const literalContent = noteSource.substring(
        isEmbed
          ? node.position!.start.offset! - 1
          : node.position!.start.offset!,
        node.position!.end.offset!
      );

      const range = isEmbed
        ? Range.create(
            node.position.start.line - 1,
            node.position.start.column - 2,
            node.position.end.line - 1,
            node.position.end.column - 1
          )
        : astPositionToFoamRange(node.position!);

      note.links.push({
        type: 'wikilink',
        rawText: literalContent,
        range,
        isEmbed,
      });
    }
    if (node.type === 'link' || node.type === 'image') {
      const targetUri = (node as any).url;
      const uri = note.uri.resolve(targetUri);
      if (uri.scheme !== 'file' || uri.path === note.uri.path) {
        return;
      }
      const literalContent = noteSource.substring(
        node.position!.start.offset!,
        node.position!.end.offset!
      );
      note.links.push({
        type: 'link',
        rawText: literalContent,
        range: astPositionToFoamRange(node.position!),
        isEmbed: literalContent.startsWith('!'),
      });
    }
  },
};

const definitionsPlugin: ParserPlugin = {
  name: 'definitions',
  visit: (node, note) => {
    if (node.type === 'definition') {
      note.definitions.push({
        label: (node as any).label,
        url: (node as any).url,
        title: (node as any).title,
        range: astPositionToFoamRange(node.position!),
      });
    }
  },
  onDidVisitTree: (tree, note) => {
    const end = astPointToFoamPosition(tree.position.end);
    note.definitions = getFoamDefinitions(note.definitions, end);
  },
};

const handleError = (
  plugin: ParserPlugin,
  fnName: string,
  uri: URI | undefined,
  e: Error
): void => {
  const name = plugin.name || '';
  Logger.warn(
    `Error while executing [${fnName}] in plugin [${name}]. ${
      uri ? 'for file [' + uri.toString() : ']'
    }.`,
    e
  );
};

function getFoamDefinitions(
  defs: NoteLinkDefinition[],
  fileEndPoint: Position
): NoteLinkDefinition[] {
  let previousLine = fileEndPoint.line;
  const foamDefinitions = [];

  // walk through each definition in reverse order
  // (last one first)
  for (const def of defs.reverse()) {
    // if this definition is more than 2 lines above the
    // previous one below it (or file end), that means we
    // have exited the trailing definition block, and should bail
    const start = def.range!.start.line;
    if (start < previousLine - 2) {
      break;
    }

    foamDefinitions.unshift(def);
    previousLine = def.range!.end.line;
  }

  return foamDefinitions;
}

/**
 * Converts the 1-index Point object into the VS Code 0-index Position object
 * @param point ast Point (1-indexed)
 * @returns Foam Position  (0-indexed)
 */
const astPointToFoamPosition = (point: Point): Position => {
  return Position.create(point.line - 1, point.column - 1);
};

/**
 * Converts the 1-index Position object into the VS Code 0-index Range object
 * @param position an ast Position object (1-indexed)
 * @returns Foam Range  (0-indexed)
 */
const astPositionToFoamRange = (pos: AstPosition): Range =>
  Range.create(
    pos.start.line - 1,
    pos.start.column - 1,
    pos.end.line - 1,
    pos.end.column - 1
  );
