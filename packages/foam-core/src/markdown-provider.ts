import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import frontmatterPlugin from 'remark-frontmatter';
import { parse as parseYAML } from 'yaml';
import visit from 'unist-util-visit';
import { Parent, Point } from 'unist';
import detectNewline from 'detect-newline';
import os from 'os';
import { NoteGraphAPI } from './model/note-graph';
import { NoteLinkDefinition, Note, NoteParser } from './model/note';
import { dropExtension, extractHashtags, extractTagsFromProp } from './utils';
import { uriToSlug, computeRelativePath, getBasename } from './utils/uri';
import { ParserPlugin } from './plugins';
import { Logger } from './utils/log';
import { URI } from './common/uri';

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
        position: node.position!,
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
        position: node.position,
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
        properties: {},
        title: null,
        tags: new Set(),
        links: [],
        definitions: [],
        source: {
          text: markdown,
          contentStart: tree.position!.start,
          end: tree.position!.end,
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
            note.source.contentStart = {
              line: node.position!.end.line! + 1,
              column: 1,
              offset: node.position!.end.offset! + 1,
            };

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
  fileEndPoint: Point
): NoteLinkDefinition[] {
  let previousLine = fileEndPoint.line;
  let foamDefinitions = [];

  // walk through each definition in reverse order
  // (last one first)
  for (const def of defs.reverse()) {
    // if this definition is more than 2 lines above the
    // previous one below it (or file end), that means we
    // have exited the trailing definition block, and should bail
    const start = def.position!.start.line;
    if (start < previousLine - 2) {
      break;
    }

    foamDefinitions.unshift(def);
    previousLine = def.position!.end.line;
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
  graph: NoteGraphAPI,
  noteUri: URI,
  includeExtension: boolean
): NoteLinkDefinition[] {
  const source = graph.getNote(noteUri);

  // Should never occur since we're already in a file,
  // but better safe than sorry.
  if (!source) {
    console.warn(
      `Note ${noteUri} was not added to NoteGraph before attempting to generate markdown reference list`
    );
    return [];
  }

  return graph
    .getForwardLinks(noteUri)
    .map(link => {
      let target = graph.getNote(link.to);
      // if we don't find the target by ID we search the graph by slug
      if (!target) {
        const candidates = graph.getNotes({ slug: link.link.slug });
        if (candidates.length > 1) {
          Logger.info(
            `Warning: Slug ${link.link.slug} matches ${candidates.length} documents. Picking one.`
          );
        }
        target = candidates.length > 0 ? candidates[0] : null;
      }
      // We are dropping links to non-existent notes here,
      // but int the future we may want to surface these too
      if (!target) {
        Logger.info(
          `Warning: Link '${link.to}' in '${noteUri}' points to a non-existing note.`
        );
        return null;
      }

      const relativePath = computeRelativePath(source.uri, target.uri);

      const pathToNote = includeExtension
        ? relativePath
        : dropExtension(relativePath);

      // [wiki-link-text]: path/to/file.md "Page title"
      return {
        label: link.link.slug,
        url: pathToNote,
        title: target.title || uriToSlug(target.uri),
      };
    })
    .filter(Boolean)
    .sort() as NoteLinkDefinition[];
}
