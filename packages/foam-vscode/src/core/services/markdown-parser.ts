// eslint-disable-next-line import/no-extraneous-dependencies
import { Point, Node, Position as AstPosition } from 'unist';
import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import frontmatterPlugin from 'remark-frontmatter';
import { parse as parseYAML } from 'yaml';
import visit from 'unist-util-visit';
import {
  Block,
  BlockType,
  NoteLinkDefinition,
  Resource,
  ResourceLink,
  ResourceParser,
} from '../model/note';
import { Position } from '../model/position';
import { Range } from '../model/range';
import { extractHashtags, extractTagsFromProp, hash, isSome } from '../utils';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { ICache } from '../utils/cache';

export interface ParserPlugin {
  name?: string;
  visit?: (node: Node, note: Resource, noteSource: string) => void;
  onDidInitializeParser?: (parser: unified.Processor) => void;
  onWillParseMarkdown?: (markdown: string) => string;
  onWillVisitTree?: (tree: Node, note: Resource) => void;
  onDidVisitTree?: (tree: Node, note: Resource) => void;
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

const parser = unified()
  .use(markdownParse, { gfm: true })
  .use(frontmatterPlugin, ['yaml'])
  .use(wikiLinkPlugin, { aliasDivider: '|' });

export function getLinkDefinitions(markdown: string): NoteLinkDefinition[] {
  const definitions: NoteLinkDefinition[] = [];
  const tree = parser.parse(markdown);
  visit(tree, node => {
    if (node.type === 'definition') {
      definitions.push({
        label: (node as any).label,
        url: (node as any).url,
        title: (node as any).title,
        range: astPositionToFoamRange(node.position!),
      });
    }
  });
  return definitions;
}

export function createMarkdownParser(
  extraPlugins: ParserPlugin[] = [],
  cache?: ParserCache
): ResourceParser {
  const plugins = [
    titlePlugin,
    wikilinkPlugin,
    tagsPlugin,
    aliasesPlugin,
    sectionsPlugin,
    blocksPlugin,
    ...extraPlugins,
  ];

  for (const plugin of plugins) {
    try {
      plugin.onDidInitializeParser?.(parser);
    } catch (e) {
      handleError(plugin, 'onDidInitializeParser', undefined, e);
    }
  }

  const foamParser: ResourceParser = {
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
        blocks: [],
        tags: [],
        aliases: [],
        links: [],
      };

      const localDefinitions: NoteLinkDefinition[] = [];

      for (const plugin of plugins) {
        try {
          plugin.onWillVisitTree?.(tree, note);
        } catch (e) {
          handleError(plugin, 'onWillVisitTree', uri, e);
        }
      }
      visit(tree, node => {
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

        if (node.type === 'definition') {
          localDefinitions.push({
            label: (node as any).label,
            url: (node as any).url,
            title: (node as any).title,
            range: astPositionToFoamRange(node.position!),
          });
        }

        for (const plugin of plugins) {
          try {
            plugin.visit?.(node, note, markdown);
          } catch (e) {
            handleError(plugin, 'visit', uri, e);
          }
        }
      });
      for (const plugin of plugins) {
        try {
          plugin.onDidVisitTree?.(tree, note);
        } catch (e) {
          handleError(plugin, 'onDidVisitTree', uri, e);
        }
      }

      // Post-processing: Resolve reference identifiers to definitions for all links
      note.links.forEach(link => {
        if (ResourceLink.isUnresolvedReference(link)) {
          // This link has a reference identifier (from linkReference or wikilink)
          const referenceId = link.definition;
          const definition = localDefinitions.find(
            def => def.label === referenceId
          );

          // Set definition to definition object if found, otherwise keep as string
          (link as any).definition = definition || referenceId;
        }
      });

      // For type: 'link', keep only if:
      // - It's a direct link [text](url) - no definition field
      // - It's a resolved reference - definition is an object
      note.links = note.links.filter(
        link =>
          link.type === 'wikilink' || !ResourceLink.isUnresolvedReference(link)
      );

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
      const resource = foamParser.parse(uri, markdown);
      cache.set(uri, { checksum: actualChecksum, resource });
      return resource;
    },
  };

  return isSome(cache) ? cachedParser : foamParser;
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
    if (node.type === 'text' || node.type === 'wikiLink') {
      text = text + ((node as any).value || '');
    }
  });
  return text;
};

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

let sectionStack: Array<{ label: string; level: number; start: Position }> = [];
const sectionsPlugin: ParserPlugin = {
  name: 'section',
  onWillVisitTree: () => {
    sectionStack = [];
  },
  visit: (node, note) => {
    if (node.type === 'heading') {
      const level = (node as any).depth;
      const rawLabel = getTextFromChildren(node);
      // Strip trailing block anchor (e.g. "My Heading ^blockid" → "My Heading")
      const label = rawLabel.replace(/\s\^[a-zA-Z0-9-]+$/, '');
      if (!label || !level) {
        return;
      }
      const start = astPositionToFoamRange(node.position!).start;

      // Close all the sections that are not parents of the current section
      while (
        sectionStack.length > 0 &&
        sectionStack[sectionStack.length - 1].level >= level
      ) {
        const section = sectionStack.pop();
        note.sections.push({
          label: section.label,
          range: Range.createFromPosition(section.start, start),
        });
      }

      // Add the new section to the stack
      sectionStack.push({ label, level, start });
    }
  },
  onDidVisitTree: (tree, note) => {
    const end = Position.create(
      astPointToFoamPosition(tree.position.end).line + 1,
      0
    );
    // Close all the remaining sections
    while (sectionStack.length > 0) {
      const section = sectionStack.pop();
      note.sections.push({
        label: section.label,
        range: { start: section.start, end },
      });
    }
    note.sections.sort((a, b) =>
      Position.compareTo(a.range.start, b.range.start)
    );
  },
};

// Captures the whitespace character before the anchor so we can distinguish
// same-line ( ) from own-line (\n) markers.
const BLOCK_ANCHOR_REGEX = /(\s)\^([a-zA-Z0-9-]+)$/;
// Matches a paragraph that contains *only* a block anchor (full-line syntax).
const STANDALONE_BLOCK_ANCHOR_RE = /^\^([a-zA-Z0-9-]+)$/;

/**
 * Returns the direct text content of a node, without descending into
 * child list items or other nested block elements. For list items,
 * only the text of the first paragraph child is considered so that
 * anchors on sub-items are not attributed to the parent.
 */
const getDirectText = (node: Node): string => {
  if (node.type === 'listItem') {
    const firstPara = (node as any).children?.find(
      (c: any) => c.type === 'paragraph'
    );
    return firstPara ? getTextFromChildren(firstPara) : '';
  }
  return getTextFromChildren(node);
};

const BLOCK_NODE_TYPES: Record<string, BlockType> = {
  paragraph: 'paragraph',
  listItem: 'list-item',
  blockquote: 'blockquote',
  heading: 'heading',
};

// Block types where the ^id appears on its own line *after* the block (as a
// sibling paragraph in the remark AST).
const FULL_LINE_SIBLING_TYPES: Record<string, BlockType> = {
  code: 'code',
  table: 'table',
  blockquote: 'blockquote',
};

const blocksPlugin: ParserPlugin = {
  name: 'blocks',
  visit: (node, note, noteSource) => {
    const blockType = BLOCK_NODE_TYPES[node.type];
    if (!blockType) {
      return;
    }
    const text = getDirectText(node);
    const match = BLOCK_ANCHOR_REGEX.exec(text);
    if (!match) {
      return;
    }
    const [, whitespace, id] = match;

    // Full-line block ID on a list item: the ^id is on its own line and remark
    // absorbs it via lazy continuation into the last listItem's paragraph.
    // Skip both the listItem and the paragraph — onDidVisitTree registers the list.
    if (
      whitespace === '\n' &&
      (blockType === 'list-item' || blockType === 'paragraph')
    ) {
      return;
    }

    const startLine = node.position!.start.line - 1; // convert AST 1-based to 0-based
    // A listItem and its first-paragraph child both start on the same line and
    // carry the same anchor. Skip the paragraph once the listItem is registered.
    // Using start line (not end line) handles nested subitems that extend the
    // parent listItem's end line beyond the anchor line.
    if (
      note.blocks.some(b => b.id === id && b.range.start.line === startLine)
    ) {
      return;
    }

    // Full-line block ID on a blockquote: remark absorbs the ^id via lazy
    // continuation, so the blockquote's end line includes the ^id line. Adjust
    // the range to exclude that line so embeds don't include the raw marker.
    const pos =
      whitespace === '\n' && blockType === 'blockquote'
        ? {
            ...node.position!,
            end: {
              ...node.position!.end,
              line: node.position!.end.line - 1,
            },
          }
        : node.position!;

    // The marker end position: for list-items the ^id is on the first
    // paragraph's line, not necessarily the listItem's last line.
    const markerEndPos =
      blockType === 'list-item'
        ? ((node as any).children?.find((c: any) => c.type === 'paragraph')
            ?.position?.end ?? node.position!.end)
        : node.position!.end;

    const markerRange =
      whitespace === '\n' && blockType === 'blockquote'
        ? // Own-line marker: the ^id is on the last line, possibly prefixed by "> ".
          // Find the actual column by scanning the source line.
          (() => {
            const markerLine = node.position!.end.line - 1; // 0-indexed
            const sourceLine = noteSource.split('\n')[markerLine] ?? '';
            const markerCol = sourceLine.indexOf(`^${id}`);
            const col = markerCol >= 0 ? markerCol : 0;
            return Range.create(markerLine, col, markerLine, col + id.length + 1);
          })()
        : // Inline marker: ' ^id' at the end of the element's last line.
          Range.create(
            markerEndPos.line - 1,
            markerEndPos.column - 1 - (id.length + 2), // space + '^' + id
            markerEndPos.line - 1,
            markerEndPos.column - 1
          );

    note.blocks.push({
      id,
      type: blockType,
      range: astPositionToFoamRange(pos),
      markerRange,
    });
  },

  onDidVisitTree: (tree, note) => {
    // Handle full-line block IDs for block types where the ^id appears as a
    // standalone sibling paragraph immediately after the target block (code,
    // table) or is absorbed into the last list item (list).
    visit(tree, (parentNode: any) => {
      if (!Array.isArray(parentNode.children)) {
        return;
      }
      const children: any[] = parentNode.children;

      for (let i = 0; i < children.length; i++) {
        const current = children[i];

        // Case A: code/table — remark places the ^id as the next sibling paragraph.
        // Allow up to one blank line between the block and the ^id paragraph so
        // markdown formatters that insert blank lines don't break the syntax.
        if (FULL_LINE_SIBLING_TYPES[current.type]) {
          const next = children[i + 1];
          if (
            next?.type === 'paragraph' &&
            next.position.start.line <= current.position.end.line + 2
          ) {
            const nextText = getTextFromChildren(next).trim();
            const idMatch = STANDALONE_BLOCK_ANCHOR_RE.exec(nextText);
            if (idMatch) {
              const id = idMatch[1];
              if (!note.blocks.some(b => b.id === id)) {
                note.blocks.push({
                  id,
                  type: FULL_LINE_SIBLING_TYPES[current.type],
                  range: astPositionToFoamRange(current.position),
                  // Marker is the ^id paragraph on its own line.
                  markerRange: Range.create(
                    next.position.start.line - 1,
                    0,
                    next.position.start.line - 1,
                    id.length + 1
                  ),
                });
              }
            }
          }
        }

        // Case B: list — remark absorbs the ^id into the last listItem's text
        // as a new line. Register the ID for the *full list* instead.
        if (current.type === 'list') {
          const items: any[] = current.children ?? [];
          const lastItem = items[items.length - 1];
          if (!lastItem) continue;
          const text = getDirectText(lastItem);
          const match = /\n\^([a-zA-Z0-9-]+)$/.exec(text);
          if (!match) continue;
          const id = match[1];
          if (note.blocks.some(b => b.id === id)) continue;
          // Range covers the whole list minus the ^id line.
          const adjustedPos = {
            ...current.position,
            end: {
              ...current.position.end,
              line: current.position.end.line - 1,
            },
          };
          note.blocks.push({
            id,
            type: 'list',
            range: astPositionToFoamRange(adjustedPos),
            // Marker is ^id on the original last line of the list.
            markerRange: Range.create(
              current.position.end.line - 1,
              0,
              current.position.end.line - 1,
              id.length + 1
            ),
          });
        }
      }
    });
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
        definition: (node as any).value,
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
    if (node.type === 'linkReference') {
      const literalContent = noteSource.substring(
        node.position!.start.offset!,
        node.position!.end.offset!
      );

      const identifier = (node as any).identifier;

      note.links.push({
        type: 'link',
        rawText: literalContent,
        range: astPositionToFoamRange(node.position!),
        isEmbed: false,
        // Store reference identifier temporarily - will be resolved in onDidVisitTree
        definition: identifier,
      });
    }
  },
  onDidVisitTree: (tree, note) => {
    // This onDidVisitTree is now handled globally after all plugins have run
    // and localDefinitions have been collected.
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

const blockParser = unified().use(markdownParse, { gfm: true });
export const getBlockFor = (
  markdown: string,
  line: number | Position
): { block: string; nLines: number } => {
  const searchLine = typeof line === 'number' ? line : line.line;
  const tree = blockParser.parse(markdown);
  const lines = markdown.split('\n');
  let startLine = -1;
  let endLine = -1;

  // For list items, we also include the sub-lists
  visit(tree, ['listItem'], (node: any) => {
    if (node.position.start.line === searchLine + 1) {
      startLine = node.position.start.line - 1;
      endLine = node.position.end.line;
      return visit.EXIT;
    }
  });

  // For headings, we also include the sub-sections
  let headingLevel = -1;
  visit(tree, ['heading'], (node: any) => {
    if (startLine > -1 && node.depth <= headingLevel) {
      endLine = node.position.start.line - 1;
      return visit.EXIT;
    }
    if (node.position.start.line === searchLine + 1) {
      headingLevel = node.depth;
      startLine = node.position.start.line - 1;
      endLine = lines.length - 1; // in case it's the last section
    }
  });

  let nLines = startLine === -1 ? 1 : endLine - startLine;
  let block =
    startLine === -1
      ? lines[searchLine] ?? ''
      : lines.slice(startLine, endLine).join('\n');

  return { block, nLines };
};
