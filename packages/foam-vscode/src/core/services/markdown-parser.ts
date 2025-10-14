// eslint-disable-next-line import/no-extraneous-dependencies
import { Point, Node, Position as AstPosition } from 'unist';
import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import frontmatterPlugin from 'remark-frontmatter';
import { parse as parseYAML } from 'yaml';
import visit from 'unist-util-visit';
import {
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
import { FrontmatterMarkdownDirector } from './markdown-director';
import { phases, TrainNote } from '../model/train-note';
import { Phase } from '../model/phase';

export interface ParserPlugin<T> {
  name?: string;
  visit?: (node: Node, target: T, noteSource: string) => void;
  onDidInitializeParser?: (parser: unified.Processor) => void;
  onWillParseMarkdown?: (markdown: string) => string;
  onWillVisitTree?: (tree: Node, target: T) => void;
  onDidVisitTree?: (tree: Node, target: T) => void;
  onDidFindProperties?: (properties: any, target: T, node: Node) => void;
  onDidCollectLocalDefinitions?(
    localDefinitions: NoteLinkDefinition[],
    target: T
  );
}

type Checksum = string;

export interface ParserCacheEntry<T> {
  checksum: Checksum;
  target: T;
}

/**
 * This caches the parsed markdown for a given URI.
 *
 * The URI identifies the resource that needs to be parsed,
 * the checksum identifies the text that needs to be parsed.
 *
 * If the URI and the Checksum have not changed, the cached resource is returned.
 */
export type ParserCache<T> = ICache<URI, ParserCacheEntry<T>>;

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
  extraPlugins: ParserPlugin<Resource>[] = [],
  resourceCache?: ParserCache<Resource>,
  trainNoteCache?: ParserCache<TrainNote>
): FrontmatterMarkdownDirector<Resource> {
  const resourceParser = NoteParser(extraPlugins);
  const trainnoteParser = TrainNoteParser();

  const parserMap: Record<string, ResourceParser<any>> = {};
  isSome(resourceCache)
    ? (parserMap['note'] = new CachedParser<Resource>(
        resourceCache,
        resourceParser
      ))
    : (parserMap['note'] = resourceParser);

  isSome(trainNoteCache)
    ? (parserMap['training-note'] = new CachedParser<TrainNote>(
        trainNoteCache,
        trainnoteParser
      ))
    : (parserMap['training-note'] = trainnoteParser);

  return new FrontmatterMarkdownDirector(parserMap);
}

export const resourceRehydration = (uri: URI, note: Resource): Resource => {
  return Object.assign(resourceFactory(uri), note, { uri: uri });
};

export const resourceFactory = (uri: URI): Resource => {
  return {
    uri: uri,
    type: 'note',
    properties: {},
    title: '',
    sections: [],
    tags: [],
    aliases: [],
    links: [],
  };
};

export const trainFactory = (uri: URI): TrainNote => {
  var trainNote = new TrainNote(phases);
  var resource = resourceFactory(uri);
  Object.assign(trainNote, resource);
  trainNote.type = 'training-note';
  return trainNote;
};

export const trainrehydration = (uri: URI, trainnote: TrainNote): TrainNote => {
  var trainNote = new TrainNote(phases);
  var resource = resourceRehydration(uri, trainnote);
  Object.assign(trainNote, resource);
  trainNote.type = 'training-note';
  trainNote.currentPhase =
    trainNote.currentPhase instanceof Phase
      ? trainNote.currentPhase
      : new Phase(trainnote.currentPhase.name, trainnote.currentPhase.days);
  trainNote.nextReminder =
    trainnote.nextReminder instanceof Date
      ? trainnote.nextReminder
      : new Date(trainnote.nextReminder);

  return trainNote;
};

function NoteParser(extraPlugins: ParserPlugin<Resource>[]) {
  const plugins = [
    titlePlugin,
    wikilinkPlugin,
    tagsPlugin,
    aliasesPlugin,
    sectionsPlugin,
    propertiesPlugin,
    ...extraPlugins,
  ];

  const resourceParser = new FoamParser<Resource>(resourceFactory, ...plugins);
  return resourceParser;
}

function TrainNoteParser() {
  const plugins = [
    titlePlugin,
    wikilinkPlugin,
    tagsPlugin,
    aliasesPlugin,
    sectionsPlugin,
    propertiesPlugin,
    PhasePlugin,
    ReminderPlugin,
  ];

  const trainNoteParser = new FoamParser<TrainNote>(trainFactory, ...plugins);
  return trainNoteParser;
}

export class FoamParser<T> implements ResourceParser<T> {
  constructor(factory: (uri: URI) => T, ...plugins: ParserPlugin<T>[]) {
    this.factory = factory;
    this.plugins = plugins;
  }

  private factory: (uri: URI) => T;
  private plugins: ParserPlugin<T>[];

  parse(uri: URI, markdown: string): T {
    const parser = this.initParser();

    Logger.debug('Parsing:', uri.toString());

    this.invokePluginHook('onWillParseMarkdown', uri, markdown);
    const tree = parser.parse(markdown);
    const target: T = this.factory(uri);
    const localDefinitions: NoteLinkDefinition[] = this.visitTree(
      uri,
      tree,
      target,
      markdown
    );

    this.invokePluginHook(
      'onDidCollectLocalDefinitions',
      uri,
      localDefinitions,
      target
    );

    Logger.debug('Result:', target);
    return target;
  }

  private visitTree(
    uri: URI,
    tree,
    target: T,
    markdown: string
  ): NoteLinkDefinition[] {
    let localDefinitions: NoteLinkDefinition[] = [];
    this.invokePluginHook('onWillVisitTree', uri, tree, target);

    visit(tree, node => {
      this.checkYaml(node, uri, target);
      localDefinitions = this.checkDefinition(node);
      this.invokePluginHook('visit', uri, node, target, markdown);
    });

    this.invokePluginHook('onDidVisitTree', uri, tree, target);
    return localDefinitions;
  }

  private checkYaml(node, uri: URI, target: T) {
    if (node.type === 'yaml') {
      try {
        this.parseProperties(node, uri, target);
      } catch (e) {
        Logger.warn(`Error while parsing YAML for [${uri.toString()}]`, e);
      }
    }
  }

  private checkDefinition(node) {
    const localDefinitions: NoteLinkDefinition[] = [];
    if (node.type === 'definition') {
      localDefinitions.push({
        label: (node as any).label,
        url: (node as any).url,
        title: (node as any).title,
        range: astPositionToFoamRange(node.position!),
      });
    }

    return localDefinitions;
  }

  private parseProperties(node, uri: URI, target: T) {
    const yamlProperties = parseYAML((node as any).value) ?? {};
    this.invokePluginHook(
      'onDidFindProperties',
      uri,
      yamlProperties,
      target,
      node
    );
  }

  private invokePluginHook<
    K extends {
      [P in keyof ParserPlugin<T>]: ParserPlugin<T>[P] extends (
        ...args: any[]
      ) => any
        ? P
        : never;
    }[keyof ParserPlugin<T>]
  >(hook: K, uri: URI, ...args: Parameters<NonNullable<ParserPlugin<T>[K]>>) {
    for (const plugin of this.plugins) {
      try {
        (
          plugin[hook] as (
            ...args: Parameters<NonNullable<ParserPlugin<T>[K]>>
          ) => void
        )?.(...args);
      } catch (e) {
        handleError(plugin, hook as string, uri, e);
      }
    }
  }

  private initParser() {
    this.invokePluginHook('onDidInitializeParser', undefined, parser);
    return parser;
  }
}

export class CachedParser<T> implements ResourceParser<T> {
  constructor(cache: ParserCache<T>, parser: ResourceParser<T>) {
    this.cache = cache;
    this.parser = parser;
  }

  private cache: ParserCache<T>;
  private parser: ResourceParser<T>;

  parse(uri: URI, markdown: string): T {
    const actualChecksum = hash(markdown);
    if (this.cache.has(uri)) {
      const { checksum, target } = this.cache.get(uri);
      if (actualChecksum === checksum) {
        return target;
      }
    }

    const parsedTarget = this.parser.parse(uri, markdown);
    this.cache.set(uri, { checksum: actualChecksum, target: parsedTarget });
    return parsedTarget;
  }
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

export const tagsPlugin: ParserPlugin<Resource> = {
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
export const sectionsPlugin: ParserPlugin<Resource> = {
  name: 'section',
  onWillVisitTree: () => {
    sectionStack = [];
  },
  visit: (node, note) => {
    if (node.type === 'heading') {
      const level = (node as any).depth;
      const label = getTextFromChildren(node);
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

export const titlePlugin: ParserPlugin<Resource> = {
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

export const aliasesPlugin: ParserPlugin<Resource> = {
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

export const wikilinkPlugin: ParserPlugin<Resource> = {
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

  onDidCollectLocalDefinitions: (localDefinitions, target) => {
    // Post-processing: Resolve reference identifiers to definitions for all links
    target.links.forEach(link => {
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
    target.links = target.links.filter(
      link =>
        link.type === 'wikilink' || !ResourceLink.isUnresolvedReference(link)
    );
  },
};

export const propertiesPlugin: ParserPlugin<Resource> = {
  name: 'properties',
  onDidFindProperties: (properties: any, note: Resource, node: Node) => {
    note.properties = {
      ...note.properties,
      ...properties,
    };
  },
};

export const typePlugin: ParserPlugin<{ type: string }> = {
  name: 'type',
  onDidFindProperties: (properties, target, node: Node) => {
    if ('type' in properties) {
      target.type = properties.type;
    } else {
      target.type = 'note';
    }
  },
};

export const PhasePlugin: ParserPlugin<TrainNote> = {
  name: 'phase',
  onDidFindProperties: (properties, target, node: Node) => {
    if ('currentPhase' in properties) {
      target.currentPhase = properties.currentPhase as Phase;
    }
  },
};

export const ReminderPlugin: ParserPlugin<TrainNote> = {
  name: 'reminder',
  onDidFindProperties: (properties, target, node: Node) => {
    if ('nextReminder' in properties) {
      target.nextReminder = new Date(properties.nextReminder);
    }
  },
};

const handleError = <T>(
  plugin: ParserPlugin<T>,
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
