import { Node, Position as AstPosition } from 'unist';
import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import frontmatterPlugin from 'remark-frontmatter';
import { parse as parseYAML } from 'yaml';
import visit from 'unist-util-visit';
import { Parent, Point } from 'unist';
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
import {
  dropExtension,
  extractHashtags,
  extractTagsFromProp,
  isNone,
  isSome,
} from './utils';
import { ParserPlugin } from './plugins';
import { Logger } from './utils/log';
import { URI } from './model/uri';
import { FoamWorkspace } from './model/workspace';
import { ResourceProvider } from 'model/provider';
import { IDataStore, FileDataStore, IMatcher } from './services/datastore';
import { IDisposable } from 'common/lifecycle';

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
      this.matcher.include.map(glob => this.dataStore.list(glob))
    );
    const files = this.matcher.match(filesByFolder.flat());

    await Promise.all(
      files.map(async uri => {
        Logger.info('Found: ' + URI.toString(uri));
        if (this.match(uri)) {
          const content = await this.dataStore.read(uri);
          if (isSome(content)) {
            workspace.set(this.parser.parse(uri, content));
          }
        }
      })
    );

    this.disposables =
      this.watcherInit?.({
        onDidChange: async uri => {
          if (this.matcher.isMatch(uri)) {
            const content = await this.dataStore.read(uri);
            isSome(content) &&
              workspace.set(await this.parser.parse(uri, content));
          }
        },
        onDidCreate: async uri => {
          if (this.matcher.isMatch(uri)) {
            const content = await this.dataStore.read(uri);
            isSome(content) &&
              workspace.set(await this.parser.parse(uri, content));
          }
        },
        onDidDelete: uri => {
          this.matcher.isMatch(uri) && workspace.delete(uri);
        },
      }) ?? [];
  }

  match(uri: URI) {
    return URI.isMarkdownFile(uri);
  }

  read(uri: URI): Promise<string | null> {
    return this.dataStore.read(uri);
  }

  readAsMarkdown(uri: URI): Promise<string | null> {
    return this.dataStore.read(uri);
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
      case 'wikilink':
        const definitionUri = resource.definitions.find(
          def => def.label === link.slug
        )?.url;
        if (isSome(definitionUri)) {
          const definedUri = URI.resolve(definitionUri, resource.uri);
          targetUri =
            workspace.find(definedUri, resource.uri)?.uri ??
            URI.placeholder(definedUri.path);
        } else {
          targetUri =
            workspace.find(link.slug, resource.uri)?.uri ??
            URI.placeholder(link.slug);
        }
        break;

      case 'link':
        targetUri =
          workspace.find(link.target, resource.uri)?.uri ??
          URI.placeholder(URI.resolve(link.target, resource.uri).path);
        break;
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
  visit(root, 'text', node => {
    if (node.type === 'text') {
      text = text + node.value;
    }
  });
  return text;
};

const tagsPlugin: ParserPlugin = {
  name: 'tags',
  onWillVisitTree: (tree, note) => {
    note.tags = extractHashtags(note.source.text);
  },
  onDidFindProperties: (props, note) => {
    const yamlTags = extractTagsFromProp(props.tags);
    yamlTags.forEach(tag => note.tags.add(tag));
  },
};

const titlePlugin: ParserPlugin = {
  name: 'title',
  visit: (node, note) => {
    if (note.title === '' && node.type === 'heading' && node.depth === 1) {
      note.title =
        ((node as Parent)!.children?.[0]?.value as string) || note.title;
    }
  },
  onDidFindProperties: (props, note) => {
    // Give precendence to the title from the frontmatter if it exists
    note.title = props.title ?? note.title;
  },
  onDidVisitTree: (tree, note) => {
    if (note.title === '') {
      note.title = URI.getBasename(note.uri);
    }
  },
};

const wikilinkPlugin: ParserPlugin = {
  name: 'wikilink',
  visit: (node, note) => {
    if (node.type === 'wikiLink') {
      note.links.push({
        type: 'wikilink',
        slug: node.value as string,
        target: node.value as string,
        range: astPositionToFoamRange(node.position!),
      });
    }
    if (node.type === 'link') {
      const targetUri = (node as any).url;
      const uri = URI.resolve(targetUri, note.uri);
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
        label: node.label as string,
        url: node.url as string,
        title: node.title as string,
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
    `Error while executing [${fnName}] in plugin [${name}] for file [${uri?.path}]`,
    e
  );
};

export function createMarkdownParser(
  extraPlugins: ParserPlugin[]
): ResourceParser {
  const parser = unified()
    .use(markdownParse, { gfm: true })
    .use(frontmatterPlugin, ['yaml'])
    .use(wikiLinkPlugin);

  const plugins = [
    titlePlugin,
    wikilinkPlugin,
    definitionsPlugin,
    tagsPlugin,
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
      Logger.debug('Parsing:', uri);
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

      var note: Resource = {
        uri: uri,
        type: 'note',
        properties: {},
        title: '',
        tags: new Set(),
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
            const yamlProperties = parseYAML(node.value as string) ?? {};
            note.properties = {
              ...note.properties,
              ...yamlProperties,
            };
            // Give precendence to the title from the frontmatter if it exists
            note.title = note.properties.title ?? note.title;
            // Update the start position of the note by exluding the metadata
            note.source.contentStart = Position.create(
              node.position!.end.line! + 2,
              0
            );

            for (let i = 0, len = plugins.length; i < len; i++) {
              try {
                plugins[i].onDidFindProperties?.(yamlProperties, note);
              } catch (e) {
                handleError(plugins[i], 'onDidFindProperties', uri, e);
              }
            }
          } catch (e) {
            Logger.warn(`Error while parsing YAML for [${uri}]`, e);
          }
        }

        for (let i = 0, len = plugins.length; i < len; i++) {
          try {
            plugins[i].visit?.(node, note);
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
  let foamDefinitions = [];

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
  let text = `[${definition.label}]: ${definition.url}`;
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
      `Note ${noteUri} note found in workspace when attempting to generate markdown reference list`
    );
    return [];
  }

  return source.links
    .filter(isWikilink)
    .map(link => {
      const targetUri = workspace.resolveLink(source, link);
      const target = workspace.find(targetUri);
      if (isNone(target)) {
        Logger.warn(`Link ${targetUri} in ${noteUri} is not valid.`);
        return null;
      }
      if (target.type === 'placeholder') {
        // no need to create definitions for placeholders
        return null;
      }

      const relativePath = URI.relativePath(noteUri, target.uri);
      const pathToNote = includeExtension
        ? relativePath
        : dropExtension(relativePath);

      // [wiki-link-text]: path/to/file.md "Page title"
      return { label: link.slug, url: pathToNote, title: target.title };
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
