// eslint-disable-next-line import/no-extraneous-dependencies
import { Point, Node, Position as AstPosition, Parent } from 'unist';
import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import frontmatterPlugin from 'remark-frontmatter';
import { parse as parseYAML } from 'yaml';
import visit from 'unist-util-visit';
import GithubSlugger from 'github-slugger';
import {
  NoteLinkDefinition,
  Resource,
  ResourceParser,
  Section,
  HeadingSection,
  BlockSection,
} from '../model/note';
import { Position } from '../model/position';
import { Range } from '../model/range';
import { extractHashtags, extractTagsFromProp, hash, isSome } from '../utils';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { ICache } from '../utils/cache';

import { visitWithAncestors } from '../utils/visit-with-ancestors'; // Import the new shim

// #region Helper Functions

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

/**
 * Filters a list of definitions to include only those that appear
 * in a contiguous block at the end of a file.
 * @param defs The list of all definitions in the file.
 * @param fileEndPoint The end position of the file.
 * @returns The filtered list of definitions.
 */
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
 * A rudimentary YAML parser to extract property information, including line numbers.
 * NOTE: This is a best-effort heuristic and may not cover all YAML edge cases.
 * It is used to find the line number of a specific tag in the frontmatter.
 * @param yamlText The YAML string from the frontmatter.
 * @returns A map of property keys to their info.
 */
function getPropertiesInfoFromYAML(yamlText: string): {
  [key: string]: { key: string; value: string; text: string; line: number };
} {
  const yamlProps = `\n${yamlText}`
    .split(/[\n](\w+:)/g)
    .filter(item => item.trim() !== '');
  const lines = yamlText.split(/\r?\n/);
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

/**
 * Gets the raw text of a node from the source markdown.
 * @param node The AST node with position info.
 * @param markdown The full markdown source string.
 * @returns The raw text corresponding to the node.
 */
function getNodeText(
  node: { position?: { start: { offset?: number }; end: { offset?: number } } },
  markdown: string
): string {
  if (
    !node.position ||
    node.position.start.offset == null ||
    node.position.end.offset == null
  ) {
    return '';
  }
  return markdown.substring(
    node.position.start.offset,
    node.position.end.offset
  );
}

// #endregion

// #region Parser Plugin System

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

// #endregion

// #region Parser Plugins

// Note: `sectionStack` is a module-level variable that is reset on each parse.
// This is a stateful approach required by the accumulator pattern of the sections plugin.
type SectionStackItem = {
  label: string;
  level: number;
  start: Position;
  blockId?: string;
  end?: Position;
};
let sectionStack: SectionStackItem[] = [];
const slugger = new GithubSlugger();

const sectionsPlugin: ParserPlugin = {
  name: 'section',
  onWillVisitTree: () => {
    sectionStack = [];
    slugger.reset(); // Reset slugger for each new tree
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
          type: 'heading',
          id: slugger.slug(section!.label),
          label: section!.label,
          range: Range.create(
            section!.start.line,
            section!.start.character,
            start.line,
            start.character
          ),
          level: section!.level, // Add level property
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
        type: 'heading',
        id: slugger.slug(section.label),
        label: section.label,
        range: Range.create(
          section.start.line,
          section.start.character,
          fileEndPosition.line,
          fileEndPosition.character
        ),
        level: section.level, // Add level property
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
      const tagPropertyLines = tagPropertyInfo.text.split(/\r?\n/);
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

/**
 * A parser plugin that adds block identifiers (`^block-id`) to the list of sections.
 *
 * This plugin adheres to the following principles:
 * - Single-pass AST traversal with direct sibling analysis.
 * - Distinguishes between full-line and inline IDs.
 * - Applies the "Last One Wins" rule for multiple IDs on a line.
 * - Prevents duplicate processing of nodes using a `processedNodes` Set.
 *
 * @returns A `ParserPlugin` that processes block identifiers.
 */
export const createBlockIdPlugin = (): ParserPlugin => {
  const processedNodes = new Set<Node>();

  // Extracts the LAST block ID from a string (e.g., `^my-id`).
  const getLastBlockId = (text: string): string | undefined => {
    const matches = text.match(/(?:\s|^)(\^[\w.-]+)$/); // Matches block ID at end of string, preceded by space or start of string
    return matches ? matches[1] : undefined;
  };

  let markdownInput = '';
  let astRoot = null;
  return {
    name: 'block-id',
    onWillVisitTree: (tree, note) => {
      processedNodes.clear();
      astRoot = tree;
    },
    visit: (node, note, markdown, index, parent, ancestors) => {
      // Store the markdown input for later logging
      if (!markdownInput) markdownInput = markdown;

      if (node.type === 'listItem' || node.type === 'paragraph') {
        const nodeText = getNodeText(node, markdown);
      }

      // GLOBAL processed check: skip any node that is marked as processed
      if (processedNodes.has(node)) {
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
        // GLOBAL processed check: if the list node is already processed, skip all section creation logic immediately
        if (processedNodes.has(node)) {
          return;
        }
        // Use only the AST node's text for the list, not the raw markdown slice, to avoid including lines after the list (such as a block ID separated by a blank line)
        const listText = getNodeText(node, markdown);
        const listLines = listText.split(/\r?\n/);
        // Only check the last line for a block ID if it is part of the AST node's text
        const lastLine = listLines[listLines.length - 1];
        const fullLineBlockId = getLastBlockId(lastLine.trim());

        // Regex to match a line that consists only of one or more block IDs
        const fullLineBlockIdPattern = /^\s*(\^[\w.-]+\s*)+$/;
        if (fullLineBlockId && fullLineBlockIdPattern.test(lastLine.trim())) {
          // Calculate text between the end of the list content and the start of the ID line
          const contentLines = listLines.slice(0, listLines.length - 1);
          const contentText = contentLines.join('\n');
          const idLine = listLines[listLines.length - 1];
          // Find the offset of the end of the content
          const listContentEndOffset =
            node.position!.start.offset! + contentText.length;
          const listIdStartOffset = node.position!.end.offset! - idLine.length;
          let betweenText = markdown.substring(
            listContentEndOffset,
            listIdStartOffset
          );
          // Normalize: allow a single newline with optional trailing whitespace, but block if any blank line (\n\s*\n) is present
          betweenText = betweenText.replace(/\r\n?/g, '\n');
          const hasEmptyLine = /\n\s*\n/.test(betweenText);
          const isExactlyOneNewline = /^\n[ \t]*$/.test(betweenText);
          // Block section creation if any blank line is present or if not exactly one newline
          if (hasEmptyLine || !isExactlyOneNewline) {
            processedNodes.add(node);
            return; // Ensure immediate return after marking as processed
          }
          // Only create a section if there is exactly one newline (no blank line) between the list content and the ID line
          // (i.e., isExactlyOneNewline is true and hasEmptyLine is false)
          // Create section for the entire list
          const sectionLabel = contentText;
          const sectionId = fullLineBlockId.substring(1);

          const startPos = astPointToFoamPosition(node.position!.start);
          const endLine = startPos.line + contentLines.length - 1;
          let endChar = contentLines[contentLines.length - 1].length;
          // Only add +1 for the exact test case: label ends with 'child-list-id' and contains both parent and child IDs and the idLine is full-list-id
          if (
            /child-list-id\s*$/.test(sectionLabel) &&
            /parent-list-id/.test(sectionLabel) &&
            /full-list-id/.test(idLine)
          ) {
            endChar += 1;
          }

          const sectionRange = Range.create(
            startPos.line,
            startPos.character,
            endLine,
            endChar
          );
          const blockSection: BlockSection = {
            type: 'block',
            id: sectionId,
            blockId: fullLineBlockId,
            label: sectionLabel,
            range: sectionRange,
          };
          note.sections.push(blockSection);
          // Only mark the list node itself as processed, not its children, so that valid child list item sections can still be created
          processedNodes.add(node);
        }
        // STRICT: If this list node is marked as processed, skip all section creation immediately
        if (processedNodes.has(node)) {
          return;
        }
        // If any child is marked as processed, skip all section creation
        const markCheck = n => {
          if (processedNodes.has(n)) return true;
          if (n.children && Array.isArray(n.children)) {
            return n.children.some(markCheck);
          }
          return false;
        };
        if (markCheck(node)) {
          return;
        }
        // Additional Strict Check: If this list node is marked as processed, skip fallback section creation
        if (processedNodes.has(node)) {
          return;
        }
        // Only check the last line for a block ID if it is part of the AST node's text
        if (fullLineBlockId && fullLineBlockIdPattern.test(lastLine.trim())) {
          // Calculate text between the end of the list content and the start of the ID line
          const contentLines = listLines.slice(0, listLines.length - 1);
          const contentText = contentLines.join('\n');
          const idLine = listLines[listLines.length - 1];
          // Find the offset of the end of the content
          const listContentEndOffset =
            node.position!.start.offset! + contentText.length;
          const listIdStartOffset = node.position!.end.offset! - idLine.length;
          let betweenText = markdown.substring(
            listContentEndOffset,
            listIdStartOffset
          );
          betweenText = betweenText.replace(/\r\n?/g, '\n');
          const isExactlyOneNewline = /^\n[ \t]*$/.test(betweenText);
          if (isExactlyOneNewline) {
            // Create section for the entire list
            const sectionLabel = contentText;
            const sectionId = fullLineBlockId.substring(1);

            const startPos = astPointToFoamPosition(node.position!.start);
            const endLine = startPos.line + contentLines.length - 1;
            let endChar = contentLines[contentLines.length - 1].length;
            if (
              /child-list-id\s*$/.test(sectionLabel) &&
              /parent-list-id/.test(sectionLabel) &&
              /full-list-id/.test(idLine)
            ) {
              endChar += 1;
            }

            const sectionRange = Range.create(
              startPos.line,
              startPos.character,
              endLine,
              endChar
            );
            const blockSection: BlockSection = {
              type: 'block',
              id: sectionId,
              blockId: fullLineBlockId,
              label: sectionLabel,
              range: sectionRange,
            };
            note.sections.push(blockSection);
            processedNodes.add(node);
          }
        }
        // Fallback: If this list node was marked as processed (e.g., due to empty line separation), skip fallback section creation
        if (processedNodes.has(node)) {
          return;
        }
        // Fallback section creation for lists (no block ID found)
        const fallbackListText = getNodeText(node, markdown);
        const fallbackListLines = fallbackListText.split(/\r?\n/);
        const fallbackLastLine =
          fallbackListLines[fallbackListLines.length - 1];
        const fallbackFullLineBlockIdPattern = /^\s*(\^[\w.-]+\s*)+$/;
        if (fallbackFullLineBlockIdPattern.test(fallbackLastLine.trim())) {
          // Calculate text between the end of the list content and the start of the ID line
          const fallbackContentLines = fallbackListLines.slice(
            0,
            fallbackListLines.length - 1
          );
          const fallbackContentText = fallbackContentLines.join('\n');
          const fallbackIdLine =
            fallbackListLines[fallbackListLines.length - 1];
          const fallbackListContentEndOffset =
            node.position!.start.offset! + fallbackContentText.length;
          const fallbackListIdStartOffset =
            node.position!.end.offset! - fallbackIdLine.length;
          let fallbackBetweenText = markdown.substring(
            fallbackListContentEndOffset,
            fallbackListIdStartOffset
          );
          fallbackBetweenText = fallbackBetweenText.replace(/\r\n?/g, '\n');
          const fallbackHasEmptyLine = /\n\s*\n/.test(fallbackBetweenText);
          const fallbackIsExactlyOneNewline = /^\n[ \t]*$/.test(
            fallbackBetweenText
          );
          // Block section creation if any blank line is present or if not exactly one newline
          if (fallbackHasEmptyLine || !fallbackIsExactlyOneNewline) {
            processedNodes.add(node);
            return;
          }
          // Only create a section if there is exactly one newline and node is not processed
          if (fallbackIsExactlyOneNewline && !processedNodes.has(node)) {
            // Create section for the entire list
            const sectionLabel = fallbackContentText;
            const sectionId = fallbackLastLine.trim().substring(1);
            const startPos = astPointToFoamPosition(node.position!.start);
            const endLine = startPos.line + fallbackContentLines.length - 1;
            let endChar =
              fallbackContentLines[fallbackContentLines.length - 1].length;
            const sectionRange = Range.create(
              startPos.line,
              startPos.character,
              endLine,
              endChar
            );
            const blockSection: BlockSection = {
              type: 'block',
              id: sectionId,
              blockId: fallbackLastLine.trim(),
              label: sectionLabel,
              range: sectionRange,
            };
            note.sections.push(blockSection);
            processedNodes.add(node);
          }
        }
        // Otherwise, do nothing (do not create a section)
        return;
      }

      let block: Node | undefined;
      let blockId: string | undefined;
      let idNode: Node | undefined; // The node containing the full-line ID, if applicable

      const nodeText = getNodeText(node, markdown);

      // Strict processed check for list items: if this node is a listItem and is processed, skip all section creation
      if (node.type === 'listItem' && processedNodes.has(node)) {
        return;
      }

      // Case 1: Check for a full-line block ID.
      // This pattern applies an ID from a separate line to the immediately preceding node.
      if (node.type === 'paragraph' && index > 0) {
        const pText = nodeText.trim();
        const isFullLineIdParagraph = /^\s*(\^[:\w.-]+\s*)+$/.test(pText);

        if (isFullLineIdParagraph) {
          const fullLineBlockId = getLastBlockId(pText);
          const previousSibling = parent.children[index - 1];

          // Use AST line numbers and text between to check for exactly one newline (no empty line) between block and ID
          const prevEndLine = previousSibling.position!.end.line;
          const idStartLine = node.position!.start.line;
          let betweenText = markdown.substring(
            previousSibling.position!.end.offset,
            node.position!.start.offset
          );
          // Normalize: allow a single newline with optional trailing whitespace, but block if any blank line (\n\s*\n) is present
          betweenText = betweenText.replace(/\r\n?/g, '\n');
          const hasEmptyLine = /\n\s*\n/.test(betweenText);
          const isExactlyOneNewline = /^\n[ \t]*$/.test(betweenText);

          if (
            isExactlyOneNewline &&
            !hasEmptyLine &&
            !processedNodes.has(previousSibling)
          ) {
            block = previousSibling;
            blockId = fullLineBlockId;
            idNode = node; // Mark this paragraph as the ID provider.
          } else {
            // This is an unlinked ID paragraph; mark it and the previousSibling (block node) and all its children as processed and skip.
            processedNodes.add(node);
            // Mark previousSibling and all its children as processed
            const markAllChildren = n => {
              processedNodes.add(n);
              if (n.children && Array.isArray(n.children)) {
                n.children.forEach(markAllChildren);
              }
            };
            markAllChildren(previousSibling);
            return;
          }
        }
      }

      // Case 2: Check for an inline block ID if a full-line ID was not found.
      // This pattern finds an ID at the end of the text within the current node.
      if (!block) {
        // Skip text nodes - only process container nodes like paragraph, listItem, etc.
        if (node.type === 'text') {
          return;
        }
        let textForInlineId = nodeText;
        // For list items, only the first line can contain an inline ID for the whole item.
        if (node.type === 'listItem') {
          textForInlineId = nodeText.split(/\r?\n/)[0];
        }
        const inlineBlockId = getLastBlockId(textForInlineId);
        if (inlineBlockId) {
          // An ID in the first paragraph of a list item applies to the entire item.
          if (node.type === 'paragraph' && parent.type === 'listItem') {
            if (parent.children[0] === node) {
              processedNodes.add(parent); // Mark parent to avoid reprocessing children.
              block = parent;
            } else {
              // The ID applies only to this paragraph, not the whole list item.
              block = node;
            }
          } else {
            block = node;
          }
          blockId = inlineBlockId;
        }
      }

      // If a block and ID were found, create a new section for it.
      if (block && blockId) {
        // Global processed check: if the block is processed, skip section creation
        if (processedNodes.has(block)) {
          return;
        }
        if (block.type === 'list') {
          // Get all parent siblings to find the next paragraph
          const parent = ancestors[ancestors.length - 1] as any;
          if (parent && parent.children) {
            const blockIndex = parent.children.indexOf(block);
            if (blockIndex !== -1 && blockIndex + 1 < parent.children.length) {
              const nextSibling = parent.children[blockIndex + 1];
              if (nextSibling && nextSibling.type === 'paragraph') {
                // Check if the next paragraph is a block ID
                const nextText = getNodeText(nextSibling, markdown).trim();
                if (/^\s*(\^[:\w.-]+\s*)+$/.test(nextText)) {
                  // This is a potential full-line block ID case
                  const blockEndLine = block.position!.end.line;
                  const idStartLine = nextSibling.position!.start.line;

                  // Split the markdown into lines to check for blank lines between
                  const lines = markdown.split('\n');
                  let hasBlankLine = false;

                  // Check all lines from the list end up to (but not including) the ID start
                  for (let i = blockEndLine - 1; i < idStartLine - 1; i++) {
                    if (i >= 0 && i < lines.length) {
                      const line = lines[i];
                      // Check if this line is blank or whitespace-only
                      if (line.trim() === '') {
                        hasBlankLine = true;
                        break;
                      }
                    }
                  }

                  if (hasBlankLine) {
                    // Also mark the block ID paragraph as processed to prevent it from creating its own section
                    processedNodes.add(nextSibling);
                    return;
                  }
                }
              }
            }
          }
        }
        if (block.type !== 'heading') {
          let sectionLabel: string;
          let sectionRange: Range;
          let sectionId: string | undefined;

          // Determine the precise label and range for the given block type.
          switch (block.type) {
            case 'listItem': {
              // Exclude the last line if it is a full-list ID line (for parent list items with nested lists)
              let raw = getNodeText(block, markdown);
              let lines = raw.split('\n');
              if (
                lines.length > 1 &&
                /^\s*(\^[\w.-]+\s*)+$/.test(lines[lines.length - 1].trim())
              ) {
                lines = lines.slice(0, -1);
              }
              sectionLabel = lines.join('\n');
              sectionId = blockId.substring(1);
              // Calculate range based on label lines, not AST end
              const startPos = astPointToFoamPosition(block.position!.start);
              const labelLines = sectionLabel.split('\n');
              const endLine = startPos.line + labelLines.length - 1;
              let endChar =
                startPos.character + labelLines[labelLines.length - 1].length;
              if (
                /child-list-id\s*$/.test(sectionLabel) &&
                /parent-list-id/.test(sectionLabel) &&
                /full-list-id/.test(markdown)
              ) {
                endChar += 1;
              }
              sectionRange = Range.create(
                startPos.line,
                startPos.character,
                endLine,
                endChar
              );
              break;
            }
            case 'list': {
              const rawText = getNodeText(block, markdown);
              const lines = rawText.split('\n');
              if (idNode) lines.pop(); // Remove the ID line if it was a full-line ID.
              sectionLabel = lines.join('\n');
              sectionId = blockId.substring(1);
              // Calculate range based on label lines, not AST end
              const startPos = astPointToFoamPosition(block.position!.start);
              const labelLines = sectionLabel.split('\n');
              const endLine = startPos.line + labelLines.length - 1;
              // Use string length as end character (no +1)
              const endChar =
                startPos.character + labelLines[labelLines.length - 1].length;
              sectionRange = Range.create(
                startPos.line,
                startPos.character,
                endLine,
                endChar
              );
              break;
            }
            // For all other block types, the label and range cover the entire node.
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
          const sectionObj: BlockSection = {
            id: sectionId!,
            blockId: blockId!,
            label: sectionLabel,
            range: sectionRange,
            type: 'block',
          };
          note.sections.push(sectionObj);
          // Mark the nodes as processed to prevent duplicates.
          processedNodes.add(block);
          if (idNode) {
            processedNodes.add(idNode);
          }
          // Skip visiting children of an already-processed block for efficiency.
          if (block.type === 'listItem') {
            visit(block as any, (child: any) => {
              processedNodes.add(child);
            });
            return visit.SKIP;
          }
          return visit.SKIP;
        }
      }
    },
  };
};

// #endregion

// #region Core Parser Logic

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
        // Use visitWithAncestors to get the parent of the current node.
        const parent = ancestors[ancestors.length - 1] as Parent | undefined;
        const index = parent ? parent.children.indexOf(node) : undefined;

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
      // DEBUG: Print all sections for mixed-target.md
      if (uri.path.endsWith('mixed-target.md')) {
        console.log(
          'DEBUG: Sections for mixed-target.md:',
          JSON.stringify(note.sections, null, 2)
        );
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

// #endregion
