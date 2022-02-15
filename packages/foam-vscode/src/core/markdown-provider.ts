// eslint-disable-next-line import/no-extraneous-dependencies
import { Point, Node, Position as AstPosition } from 'unist';
import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import frontmatterPlugin from 'remark-frontmatter';
import { parse as parseYAML } from 'yaml';
import visit from 'unist-util-visit';
import detectNewline from 'detect-newline';
import os from 'os';
import {
  NoteLinkDefinition,
  Resource,
  ResourceLink,
  WikiLink,
  ResourceParser,
} from './model/note';
import { Position } from './model/position';
import { Range } from './model/range';
import { extractHashtags, extractTagsFromProp, isNone, isSome } from './utils';
import { Logger } from './utils/log';
import { URI } from './model/uri';
import { FoamWorkspace } from './model/workspace';
import { IDataStore, FileDataStore, IMatcher } from './services/datastore';
import { IDisposable } from './common/lifecycle';
import { ResourceProvider } from './model/provider';

const ALIAS_DIVIDER_CHAR = '|';

export interface ParserPlugin {
  name?: string;
  visit?: (node: Node, note: Resource, noteSource: string) => void;
  onDidInitializeParser?: (parser: unified.Processor) => void;
  onWillParseMarkdown?: (markdown: string) => string;
  onWillVisitTree?: (tree: Node, note: Resource) => void;
  onDidVisitTree?: (tree: Node, note: Resource) => void;
  onDidFindProperties?: (properties: any, note: Resource, node: Node) => void;
}

export class MarkdownResourceProvider implements ResourceProvider {
  private disposables: IDisposable[] = [];

  constructor(
    private readonly matcher: IMatcher,
    private readonly watcherInit?: (triggers: {
      onDidChange: (uri: URI) => void;
      onDidCreate: (uri: URI) => void;
      onDidDelete: (uri: URI) => void;
    }) => IDisposable[],
    private readonly parser: ResourceParser = createMarkdownParser([]),
    private readonly dataStore: IDataStore = new FileDataStore()
  ) {}

  async init(workspace: FoamWorkspace) {
    const filesByFolder = await Promise.all(
      this.matcher.include.map(glob =>
        this.dataStore.list(glob, this.matcher.exclude)
      )
    );
    const files = this.matcher
      .match(filesByFolder.flat())
      .filter(this.supports);

    await Promise.all(
      files.map(async uri => {
        Logger.info('Found: ' + uri.toString());
        const content = await this.dataStore.read(uri);
        if (isSome(content)) {
          workspace.set(this.parser.parse(uri, content));
        }
      })
    );

    this.disposables =
      this.watcherInit?.({
        onDidChange: async uri => {
          if (this.matcher.isMatch(uri) && this.supports(uri)) {
            const content = await this.dataStore.read(uri);
            isSome(content) &&
              workspace.set(await this.parser.parse(uri, content));
          }
        },
        onDidCreate: async uri => {
          if (this.matcher.isMatch(uri) && this.supports(uri)) {
            const content = await this.dataStore.read(uri);
            isSome(content) &&
              workspace.set(await this.parser.parse(uri, content));
          }
        },
        onDidDelete: uri => {
          this.supports(uri) && workspace.delete(uri);
        },
      }) ?? [];
  }

  supports(uri: URI) {
    return uri.isMarkdown();
  }

  read(uri: URI): Promise<string | null> {
    return this.dataStore.read(uri);
  }

  async readAsMarkdown(uri: URI): Promise<string | null> {
    let content = await this.dataStore.read(uri);
    if (isSome(content) && uri.fragment) {
      const resource = this.parser.parse(uri, content);
      const section = Resource.findSection(resource, uri.fragment);
      if (isSome(section)) {
        const rows = content.split('\n');
        content = rows
          .slice(section.range.start.line, section.range.end.line)
          .join('\n');
      }
    }
    return content;
  }

  async fetch(uri: URI) {
    const content = await this.read(uri);
    return isSome(content) ? this.parser.parse(uri, content) : null;
  }

  resolveLink(
    workspace: FoamWorkspace,
    resource: Resource,
    link: ResourceLink
  ) {
    let targetUri: URI | undefined;
    switch (link.type) {
      case 'wikilink': {
        const definitionUri = resource.definitions.find(
          def => def.label === link.target
        )?.url;
        if (isSome(definitionUri)) {
          const definedUri = resource.uri.resolve(definitionUri);
          targetUri =
            workspace.find(definedUri, resource.uri)?.uri ??
            URI.placeholder(definedUri.path);
        } else {
          const [target, section] = link.target.split('#');
          targetUri =
            target === ''
              ? resource.uri
              : workspace.find(target, resource.uri)?.uri ??
                URI.placeholder(link.target);

          if (section) {
            targetUri = targetUri.withFragment(section);
          }
        }
        break;
      }
      case 'link': {
        const [target, section] = link.target.split('#');
        targetUri =
          workspace.find(target, resource.uri)?.uri ??
          URI.placeholder(resource.uri.resolve(link.target).path);
        if (section && !targetUri.isPlaceholder()) {
          targetUri = targetUri.withFragment(section);
        }
        break;
      }
    }
    return targetUri;
  }

  dispose() {
    this.disposables.forEach(d => d.dispose());
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

const tagsPlugin: ParserPlugin = {
  name: 'tags',
  onDidFindProperties: (props, note, node) => {
    if (isSome(props.tags)) {
      const yamlTags = extractTagsFromProp(props.tags);
      yamlTags.forEach(t => {
        note.tags.push({
          label: t,
          range: astPositionToFoamRange(node.position!),
        });
      });
    }
  },
  visit: (node, note) => {
    if (node.type === 'text') {
      const tags = extractHashtags((node as any).value);
      tags.forEach(tag => {
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
      });
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
    const end = Position.create(note.source.end.line + 1, 0);
    // Close all the remainig sections
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
    // Give precendence to the title from the frontmatter if it exists
    note.title = props.title?.toString() ?? note.title;
  },
  onDidVisitTree: (tree, note) => {
    if (note.title === '') {
      note.title = note.uri.getName();
    }
  },
};

const wikilinkPlugin: ParserPlugin = {
  name: 'wikilink',
  visit: (node, note, noteSource) => {
    if (node.type === 'wikiLink') {
      const text = (node as any).value;
      const alias = node.data?.alias as string;
      const literalContent = noteSource.substring(
        node.position!.start.offset!,
        node.position!.end.offset!
      );

      const hasAlias =
        literalContent !== text && literalContent.includes(ALIAS_DIVIDER_CHAR);
      note.links.push({
        type: 'wikilink',
        rawText: literalContent,
        label: hasAlias
          ? alias.trim()
          : literalContent.substring(2, literalContent.length - 2),
        target: hasAlias
          ? literalContent
              .substring(2, literalContent.indexOf(ALIAS_DIVIDER_CHAR))
              .replace(/\\/g, '')
              .trim()
          : text.trim(),
        range: astPositionToFoamRange(node.position!),
      });
    }
    if (node.type === 'link') {
      const targetUri = (node as any).url;
      const uri = note.uri.resolve(targetUri);
      if (uri.scheme !== 'file' || uri.path === note.uri.path) {
        return;
      }
      const label = getTextFromChildren(node);
      note.links.push({
        type: 'link',
        target: targetUri,
        label: label,
        range: astPositionToFoamRange(node.position!),
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
    note.definitions = getFoamDefinitions(note.definitions, note.source.end);
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

export function createMarkdownParser(
  extraPlugins: ParserPlugin[]
): ResourceParser {
  const parser = unified()
    .use(markdownParse, { gfm: true })
    .use(frontmatterPlugin, ['yaml'])
    .use(wikiLinkPlugin, { aliasDivider: ALIAS_DIVIDER_CHAR });

  const plugins = [
    titlePlugin,
    wikilinkPlugin,
    definitionsPlugin,
    tagsPlugin,
    sectionsPlugin,
    ...extraPlugins,
  ];

  plugins.forEach(plugin => {
    try {
      plugin.onDidInitializeParser?.(parser);
    } catch (e) {
      handleError(plugin, 'onDidInitializeParser', undefined, e);
    }
  });

  const foamParser: ResourceParser = {
    parse: (uri: URI, markdown: string): Resource => {
      Logger.debug('Parsing:', uri.toString());
      markdown = plugins.reduce((acc, plugin) => {
        try {
          return plugin.onWillParseMarkdown?.(acc) || acc;
        } catch (e) {
          handleError(plugin, 'onWillParseMarkdown', uri, e);
          return acc;
        }
      }, markdown);
      const tree = parser.parse(markdown);
      const eol = detectNewline(markdown) || os.EOL;

      const note: Resource = {
        uri: uri,
        type: 'note',
        properties: {},
        title: '',
        sections: [],
        tags: [],
        links: [],
        definitions: [],
        source: {
          text: markdown,
          contentStart: astPointToFoamPosition(tree.position!.start),
          end: astPointToFoamPosition(tree.position!.end),
          eol: eol,
        },
      };

      plugins.forEach(plugin => {
        try {
          plugin.onWillVisitTree?.(tree, note);
        } catch (e) {
          handleError(plugin, 'onWillVisitTree', uri, e);
        }
      });
      visit(tree, node => {
        if (node.type === 'yaml') {
          try {
            const yamlProperties = parseYAML((node as any).value) ?? {};
            note.properties = {
              ...note.properties,
              ...yamlProperties,
            };
            // Update the start position of the note by exluding the metadata
            note.source.contentStart = Position.create(
              node.position!.end.line! + 2,
              0
            );

            for (let i = 0, len = plugins.length; i < len; i++) {
              try {
                plugins[i].onDidFindProperties?.(yamlProperties, note, node);
              } catch (e) {
                handleError(plugins[i], 'onDidFindProperties', uri, e);
              }
            }
          } catch (e) {
            Logger.warn(`Error while parsing YAML for [${uri.toString()}]`, e);
          }
        }

        for (let i = 0, len = plugins.length; i < len; i++) {
          try {
            plugins[i].visit?.(node, note, markdown);
          } catch (e) {
            handleError(plugins[i], 'visit', uri, e);
          }
        }
      });
      plugins.forEach(plugin => {
        try {
          plugin.onDidVisitTree?.(tree, note);
        } catch (e) {
          handleError(plugin, 'onDidVisitTree', uri, e);
        }
      });
      Logger.debug('Result:', note);
      return note;
    },
  };
  return foamParser;
}

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

export function stringifyMarkdownLinkReferenceDefinition(
  definition: NoteLinkDefinition
) {
  const url =
    definition.url.indexOf(' ') > 0 ? `<${definition.url}>` : definition.url;
  let text = `[${definition.label}]: ${url}`;
  if (definition.title) {
    text = `${text} "${definition.title}"`;
  }

  return text;
}
export function createMarkdownReferences(
  workspace: FoamWorkspace,
  noteUri: URI,
  includeExtension: boolean
): NoteLinkDefinition[] {
  const source = workspace.find(noteUri);
  // Should never occur since we're already in a file,
  if (source?.type !== 'note') {
    console.warn(
      `Note ${noteUri.toString()} note found in workspace when attempting \
to generate markdown reference list`
    );
    return [];
  }

  return source.links
    .filter(isWikilink)
    .map(link => {
      const targetUri = workspace.resolveLink(source, link);
      const target = workspace.find(targetUri);
      if (isNone(target)) {
        Logger.warn(
          `Link ${targetUri.toString()} in ${noteUri.toString()} is not valid.`
        );
        return null;
      }
      if (target.type === 'placeholder') {
        // no need to create definitions for placeholders
        return null;
      }

      let relativeUri = target.uri.relativeTo(noteUri.getDirectory());
      if (!includeExtension) {
        relativeUri = relativeUri.changeExtension('*', '');
      }

      // [wikilink-text]: path/to/file.md "Page title"
      return {
        label:
          link.rawText.indexOf('[[') > -1
            ? link.rawText.substring(2, link.rawText.length - 2)
            : link.rawText || link.label,
        url: relativeUri.path,
        title: target.title,
      };
    })
    .filter(isSome)
    .sort();
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

const isWikilink = (link: ResourceLink): link is WikiLink => {
  return link.type === 'wikilink';
};
