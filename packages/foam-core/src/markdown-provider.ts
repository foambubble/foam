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
  Note,
  NoteParser,
  isWikilink,
  getTitle,
  Position,
  Range,
} from './model/note';
import {
  dropExtension,
  extractHashtags,
  extractTagsFromProp,
  isNone,
  isSome,
} from './utils';
import { computeRelativePath, getBasename, parseUri } from './utils/uri';
import { ParserPlugin } from './plugins';
import { Logger } from './utils/log';
import { URI } from './common/uri';
import { FoamWorkspace } from './model/workspace';

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
    if (note.title == null && node.type === 'heading' && node.depth === 1) {
      note.title =
        ((node as Parent)!.children?.[0]?.value as string) || note.title;
    }
  },
  onDidFindProperties: (props, note) => {
    // Give precendence to the title from the frontmatter if it exists
    note.title = props.title ?? note.title;
  },
  onDidVisitTree: (tree, note) => {
    if (note.title == null) {
      note.title = getBasename(note.uri);
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
      const uri = parseUri(note.uri, targetUri);
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

export function createMarkdownParser(extraPlugins: ParserPlugin[]): NoteParser {
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

  const foamParser: NoteParser = {
    parse: (uri: URI, markdown: string): Note => {
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

      var note: Note = {
        uri: uri,
        type: 'note',
        properties: {},
        title: null,
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
            note.source.contentStart = new Position(
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

      const relativePath = computeRelativePath(noteUri, target.uri);
      const pathToNote = includeExtension
        ? relativePath
        : dropExtension(relativePath);

      // [wiki-link-text]: path/to/file.md "Page title"
      return { label: link.slug, url: pathToNote, title: getTitle(target) };
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
  return new Position(point.line - 1, point.column - 1);
};

/**
 * Converts the 1-index Position object into the VS Code 0-index Range object
 * @param position an ast Position object (1-indexed)
 * @returns Foam Range  (0-indexed)
 */
const astPositionToFoamRange = (pos: AstPosition): Range =>
  new Range(
    new Position(pos.start.line - 1, pos.start.column - 1),
    new Position(pos.end.line - 1, pos.end.column - 1)
  );
