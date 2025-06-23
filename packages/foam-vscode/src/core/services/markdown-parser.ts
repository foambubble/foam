// eslint-disable-next-line import/no-extraneous-dependencies
import { Point, Node, Position as AstPosition, Parent } from 'unist';
import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import frontmatterPlugin from 'remark-frontmatter';
import { parse as parseYAML } from 'yaml';
import visit from 'unist-util-visit';
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
import { visitWithAncestors } from '../utils/visit-with-ancestors'; // Import the new shim

// --- Helper function definitions (moved just below imports for organization) ---
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

// Dummy implementation for getPropertiesInfoFromYAML to avoid reference error
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
  }, {});
}

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

// --- Plugin and helper function definitions ---
// --- Plugin and helper function definitions ---
const slugger = new GithubSlugger();
type SectionStackItem = {
  label: string;
  level: number;
  start: Position;
  blockId?: string;
  end?: Position;
};
let sectionStack: SectionStackItem[] = [];

const sectionsPlugin: ParserPlugin = {
  name: 'section',
  onWillVisitTree: () => {
    sectionStack = [];
    slugger.reset();
  },
  visit: (node, note) => {
    if (node.type === 'heading') {
      const level = (node as any).depth;
      let label = getTextFromChildren(node);
      if (!label || !level) {
        return;
      }
      // Extract block ID if present at the end of the heading
      const inlineBlockIdRegex = /(?:^|\s)(\^[\w-]+)\s*$/;
      const match = label.match(inlineBlockIdRegex);
      let blockId: string | undefined = undefined;
      if (match) {
        blockId = match[1];
        label = label.replace(inlineBlockIdRegex, '').trim();
      }
      const start = astPositionToFoamRange(node.position!).start;
      while (
        sectionStack.length > 0 &&
        sectionStack[sectionStack.length - 1].level >= level
      ) {
        const section = sectionStack.pop();
        // For all but the current heading, keep old logic
        note.sections.push({
          id: slugger.slug(section!.label),
          label: section!.label,
          range: Range.create(
            section!.start.line,
            section!.start.character,
            start.line,
            start.character
          ),
          isHeading: true,
          ...(section.blockId ? { blockId: section.blockId } : {}),
        });
      }
      // For the current heading, push without its own end. The end will be
      // determined by the next heading or the end of the file.
      sectionStack.push({
        label,
        level,
        start,
        ...(blockId ? { blockId } : {}),
      });
    }
  },
  onDidVisitTree: (tree, note) => {
    const fileEndPosition = astPointToFoamPosition(tree.position.end);

    // Close all remaining sections.
    // These are the sections that were not closed by a subsequent heading.
    // They all extend to the end of the file.
    while (sectionStack.length > 0) {
      const section = sectionStack.pop()!;
      note.sections.push({
        id: slugger.slug(section.label),
        label: section.label,
        range: Range.create(
          section.start.line,
          section.start.character,
          fileEndPosition.line,
          fileEndPosition.character
        ),
        isHeading: true,
        ...(section.blockId ? { blockId: section.blockId } : {}),
      });
    }
    // The sections are not in order because of how we add them,
    // so we need to sort them by their start position.
    note.sections.sort((a, b) => a.range.start.line - b.range.start.line);
  },
};

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
      if (uri.scheme !== 'file' || uri.path === note.uri.path) return;
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
      visitWithAncestors(tree, (node, ancestors) => {
        // Use visitWithAncestors
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
  visit(root as any, (node: any) => {
    if (
      node.type === 'text' ||
      node.type === 'wikiLink' ||
      node.type === 'code' ||
      node.type === 'html'
    ) {
      text = text + (node.value || '');
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
      // Skip heading nodes and all their descendants; only the sectionsPlugin should handle headings and their block IDs
      if (
        node.type === 'heading' ||
        ancestors.some(a => a.type === 'heading')
      ) {
        return;
      }
      // Skip heading nodes and all their descendants; only the sectionsPlugin should handle headings and their block IDs
      if (
        node.type === 'heading' ||
        ancestors.some(a => a.type === 'heading')
      ) {
        return;
      }
      // Refined duplicate prevention logic:
      // - For listItems: only skip if the listItem itself is processed
      // - For all other nodes: skip if the node or any ancestor is processed
      let isAlreadyProcessed = false;
      if (node.type === 'listItem') {
        isAlreadyProcessed = processedNodes.has(node);
      } else {
        isAlreadyProcessed =
          processedNodes.has(node) ||
          ancestors.some(a => processedNodes.has(a));
      }
      if (isAlreadyProcessed || !parent || index === undefined) {
        return;
      }

      // NEW: Special Case for Full-Line Block IDs on Lists
      if (node.type === 'list') {
        const listText = getNodeText(node, markdown);
        const listLines = listText.split('\n');
        const lastLine = listLines[listLines.length - 1];
        const fullLineBlockId = getLastBlockId(lastLine.trim());

        if (fullLineBlockId && /^\s*(\^[\w.-]+\s*)+$/.test(lastLine.trim())) {
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

          processedNodes.add(node);
          // DO NOT mark children as processed; allow traversal to continue for list items
          // DO NOT return visit.SKIP; continue traversal so list items with their own block IDs are processed
        }
        return; // If it's a list but not a full-line ID, skip further processing in this plugin
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
          const fullLineBlockId = getLastBlockId(pText);
          // Ensure the last line consists exclusively of the block ID
          const previousSibling = parent.children[index - 1];
          const textBetween = markdown.substring(
            previousSibling.position!.end.offset!,
            node.position!.start.offset!
          );
          const isSeparatedBySingleNewline =
            textBetween.trim().length === 0 &&
            (textBetween.match(/\n/g) || []).length === 1;

          // If it's a full-line ID paragraph and correctly separated, link it to the previous block
          if (
            isSeparatedBySingleNewline &&
            !processedNodes.has(previousSibling)
          ) {
            block = previousSibling;
            blockId = fullLineBlockId;
            idNode = node; // This paragraph is the ID node
          } else {
            // If it's a full-line ID paragraph but not correctly linked,
            // mark it as processed so it doesn't get picked up as an inline ID later.
            processedNodes.add(node);
            return; // Skip further processing for this node
          }
        }
      }

      // If no full-line block ID was found for a previous sibling, check for an inline block ID on the current node
      if (!block) {
        let textForInlineId = nodeText;
        if (node.type === 'listItem') {
          textForInlineId = nodeText.split('\n')[0];
        }
        const inlineBlockId = getLastBlockId(textForInlineId);
        if (inlineBlockId) {
          // If the node is a paragraph and its parent is a listItem, the block is the listItem.
          // This is only true if the paragraph is the *first* child of the listItem.
          if (node.type === 'paragraph' && parent.type === 'listItem') {
            if (parent.children[0] === node) {
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
        }
      }

      if (block && blockId) {
        // Only process non-heading blocks
        if (block.type !== 'heading') {
          let sectionLabel: string;
          let sectionRange: Range;
          let sectionId: string | undefined;
          switch (block.type) {
            case 'listItem':
              sectionLabel = getNodeText(block, markdown);
              sectionId = blockId.substring(1);
              sectionRange = astPositionToFoamRange(block.position!);
              break;
            case 'list': {
              const rawText = getNodeText(block, markdown);
              const lines = rawText.split('\n');
              lines.pop();
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
            case 'blockquote': {
              const rawText = getNodeText(block, markdown);
              const lines = rawText.split('\n');
              lines.pop();
              sectionLabel = lines.join('\n');
              sectionId = blockId.substring(1);
              const startPos = astPointToFoamPosition(block.position!.start);
              const lastLine = lines[lines.length - 1];
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
            isHeading: false,
          });
          // Mark the block and the ID node (if full-line) as processed
          processedNodes.add(block);
          if (idNode) {
            processedNodes.add(idNode);
          }
          // For list items, mark all children as processed to prevent duplicate sections
          if (block.type === 'listItem') {
            visit(block as any, (child: any) => {
              processedNodes.add(child);
            });
            return visit.SKIP; // Stop visiting children of this list item
          }
          return visit.SKIP; // Skip further processing for this node
        }
      }
    },
  };
};
// End of file: ensure all code blocks are properly closed
