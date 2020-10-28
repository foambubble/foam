import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import frontmatterPlugin from 'remark-frontmatter';
import { parse as parseYAML } from 'yaml';
import visit from 'unist-util-visit';
import { Parent, Point } from 'unist';
import * as path from 'path';
import { NoteGraphAPI } from './note-graph';
import { NoteLinkDefinition, Note, NoteParser } from './types';
import { dropExtension, uriToSlug } from './utils';
import { ID } from './types';
import { ParserPlugin } from './plugins';

const yamlPlugin: ParserPlugin = {
  visit: (node, note) => {
    if (node.type === 'yaml') {
      note.properties = {
        ...note.properties,
        ...(parseYAML(node.value as string) ?? {}),
      };
      // Give precendence to the title from the frontmatter if it exists
      note.title = note.properties.title ?? note.title;
      // Update the start position of the note by exluding the metadata
      note.source.contentStart = {
        line: node.position!.end.line! + 1,
        column: 1,
        offset: node.position!.end.offset! + 1,
      };
    }
  },
};

const titlePlugin: ParserPlugin = {
  visit: (node, note) => {
    if (note.title == null && node.type === 'heading' && node.depth === 1) {
      note.title =
        ((node as Parent)!.children?.[0]?.value as string) || note.title;
    }
  },
  onDidVisitTree: (tree, note) => {
    if (note.title == null) {
      note.title = path.parse(note.source.uri).name;
    }
  },
};

const wikilinkPlugin: ParserPlugin = {
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

export function createMarkdownParser(extraPlugins: ParserPlugin[]): NoteParser {
  const parser = unified()
    .use(markdownParse, { gfm: true })
    .use(frontmatterPlugin, ['yaml'])
    .use(wikiLinkPlugin);

  const plugins = [
    yamlPlugin,
    titlePlugin,
    wikilinkPlugin,
    definitionsPlugin,
    ...extraPlugins,
  ];

  plugins.forEach(plugin => plugin.onDidInitializeParser?.(parser));

  return {
    parse: (uri: string, markdown: string, eol: string): Note => {
      markdown = plugins.reduce((acc, plugin) => {
        return plugin.onWillParseMarkdown?.(acc) || acc;
      }, markdown);
      const tree = parser.parse(markdown);

      var note: Note = {
        slug: uriToSlug(uri),
        properties: {},
        title: null,
        links: [],
        definitions: [],
        source: {
          uri: uri,
          text: markdown,
          contentStart: tree.position!.start,
          end: tree.position!.end,
          eol: eol,
        },
      };

      plugins.forEach(plugin => plugin.onWillVisitTree?.(tree, note));
      visit(tree, node => {
        for (let i = 0, len = plugins.length; i < len; i++) {
          plugins[i].visit?.(node, note);
        }
      });
      plugins.forEach(plugin => plugin.onDidVisitTree?.(tree, note));

      return note;
    },
  };
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
  noteId: ID,
  includeExtension: boolean
): NoteLinkDefinition[] {
  const source = graph.getNote(noteId);

  // Should never occur since we're already in a file,
  // but better safe than sorry.
  if (!source) {
    console.warn(
      `Note ${noteId} was not added to NoteGraph before attempting to generate markdown reference list`
    );
    return [];
  }

  return graph
    .getForwardLinks(noteId)
    .map(link => {
      let target = graph.getNote(link.to);
      // if we don't find the target by ID we search the graph by slug
      if (!target) {
        const candidates = graph.getNotes({ slug: link.link.slug });
        if (candidates.length > 1) {
          console.log(
            `Warning: Slug ${link.link.slug} matches ${candidates.length} documents. Picking one.`
          );
        }
        target = candidates.length > 0 ? candidates[0] : null;
      }
      // We are dropping links to non-existent notes here,
      // but int the future we may want to surface these too
      if (!target) {
        console.log(
          `Warning: Link '${link.to}' in '${noteId}' points to a non-existing note.`
        );
        return null;
      }

      const relativePath = path.relative(
        path.dirname(source.source.uri),
        target.source.uri
      );

      const pathToNote = includeExtension
        ? relativePath
        : dropExtension(relativePath);

      // [wiki-link-text]: path/to/file.md "Page title"
      return {
        label: link.link.slug,
        url: pathToNote,
        title: target.title || target.slug,
      };
    })
    .filter(Boolean)
    .sort() as NoteLinkDefinition[];
}
