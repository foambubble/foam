// eslint-disable-next-line import/no-extraneous-dependencies
import { Point, Node, Position as AstPosition, Parent } from 'unist';
import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import frontmatterPlugin from 'remark-frontmatter';
import { parse as parseYAML } from 'yaml';
import visit from 'unist-util-visit';
import visitParents from 'unist-util-visit-parents';
import { NoteLinkDefinition, Resource, ResourceParser } from '../model/note';
import { Position } from '../model/position';
import { Range } from '../model/range';
import { extractHashtags, extractTagsFromProp, hash, isSome } from '../utils';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { ICache } from '../utils/cache';

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
    createBlockIdPlugin(), // Will be rewritten from scratch
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
          plugin.onDidVisitTree?.(tree, note);
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

let sectionStack: Array<{
  label: string;
  level: number;
  start: Position;
  blockId?: string;
}> = [];
const sectionsPlugin: ParserPlugin = {
  name: 'section',
  onWillVisitTree: () => {
    sectionStack = [];
  },
  visit: (node, note) => {
    if (node.type === 'heading') {
      const level = (node as any).depth;
      let label = getTextFromChildren(node);
      let blockId: string | undefined;
      if (!label || !level) {
        return;
      }
      // Extract and remove block ID from header label
      const blockIdRegex = /\s(\^[\w-]+)$/;
      const match = label.match(blockIdRegex);
      if (match) {
        blockId = match[1].substring(1); // Remove the leading '^'
        label = label.replace(blockIdRegex, '').trim();
      }

      const start = astPositionToFoamRange(node.position!).start;

      // Close all the sections that are not parents of the current section
      while (
        sectionStack.length > 0 &&
        sectionStack[sectionStack.length - 1].level >= level
      ) {
        const section = sectionStack.pop();
        note.sections.push({
          id: slugger.slug(section.label),
          label: section.label,
          range: Range.createFromPosition(section.start, start),
          isHeading: true,
          blockId: section.blockId,
        });
      }

      // Add the new section to the stack
      sectionStack.push({ label, level, start, blockId });
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
        id: slugger.slug(section.label),
        label: section.label,
        range: { start: section.start, end },
        isHeading: true,
        blockId: section.blockId,
      });
    }
    note.sections.sort((a, b) =>
      Position.compareTo(a.range.start, b.range.start)
    );
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

import GithubSlugger from 'github-slugger';

const slugger = new GithubSlugger();

let processedNodes: Set<Node>;

const findLastDescendant = (node: Node): Node => {
  let lastNode = node;
  if ((node as Parent).children && (node as Parent).children.length > 0) {
    const children = (node as Parent).children;
    lastNode = findLastDescendant(children[children.length - 1]);
  }
  return lastNode;
};

const processBlockIdNode = (
  node: Node,
  note: Resource,
  noteSource: string,
  isHeading: boolean,
  ancestors: Node[]
) => {
  // Check if this node or any of its ancestors have already been processed
  if (
    processedNodes.has(node) ||
    ancestors.some(ancestor => processedNodes.has(ancestor))
  ) {
    return; // Skip if already processed
  }

  let startOffset = node.position.start.offset;
  let endOffset = node.position.end.offset;
  let endPosition = node.position.end;

  if (node.type === 'listItem') {
    const lastDescendant = findLastDescendant(node);
    endOffset = lastDescendant.position.end.offset;
    endPosition = lastDescendant.position.end;
  }

  const label = noteSource.substring(startOffset, endOffset);
  const blockIdRegex = /\s+(\^[\w-]+)$/m; // Use multiline flag to match end of line
  const match = label.match(blockIdRegex);

  if (match) {
    const blockIdWithCaret = match[1];
    const blockId = blockIdWithCaret.substring(1);

    note.sections.push({
      id: blockId,
      label: label,
      range: Range.create(
        node.position.start.line - 1,
        node.position.start.column - 1,
        endPosition.line - 1,
        endPosition.column - 1
      ),
      blockId: blockIdWithCaret,
      isHeading: isHeading,
    });
    processedNodes.add(node);
  }
};

const createBlockIdPlugin = (): ParserPlugin => {
  return {
    name: 'block-id',
    onWillVisitTree: () => {
      processedNodes = new Set(); // Initialize set for each parse
    },
    visit: (node, note, noteSource, index, parent, ancestors) => {
      if (node.type === 'paragraph') {
        processBlockIdNode(node, note, noteSource, false, ancestors);
      } else if (node.type === 'listItem') {
        processBlockIdNode(node, note, noteSource, false, ancestors);
      }
    },
  };
};
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
