import unified from 'unified';
import markdownParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link';
import frontmatterPlugin from 'remark-frontmatter';
import { parse as parseYAML } from 'yaml';
import visit, { CONTINUE, EXIT } from 'unist-util-visit';
import { Node, Parent, Point } from 'unist';
import * as path from 'path';
import { NoteLink, NoteLinkDefinition, NoteGraph, Note } from './note-graph';
import { dropExtension, uriToSlug } from './utils';
import { ID } from './types';

let processor: unified.Processor | null = null;

const ALIAS_DIVIDER_CHAR = '|';

function parse(markdown: string): Node {
  processor =
    processor ||
    unified()
      .use(markdownParse, { gfm: true })
      .use(frontmatterPlugin, ['yaml'])
      .use(wikiLinkPlugin, { aliasDivider: ALIAS_DIVIDER_CHAR });
  return processor.parse(markdown);
}

export function createNoteFromMarkdown(
  uri: string,
  markdown: string,
  eol: string
): Note {
  const tree = parse(markdown);
  let title: string | null = null;

  visit(tree, node => {
    if (node.type === 'heading' && node.depth === 1) {
      title = ((node as Parent)!.children[0].value as string) || title;
    }
    return title === null ? CONTINUE : EXIT;
  });

  const links: NoteLink[] = [];
  const linkDefinitions: NoteLinkDefinition[] = [];
  let frontmatter: any = {};
  let start: Point = { line: 1, column: 1, offset: 0 }; // start position of the note
  visit(tree, node => {
    if (node.type === 'yaml') {
      frontmatter = parseYAML(node.value as string) ?? {}; // parseYAML returns null if the frontmatter is empty
      // Update the start position of the note by exluding the metadata
      start = {
        line: node.position!.end.line! + 1,
        column: 1,
        offset: node.position!.end.offset! + 1,
      };
    }

    if (node.type === 'wikiLink') {
      // links can be either in format [[text]] or [[text|alias]].
      const text = node.value as string;
      const alias = node.data?.alias as string;
      const literalContent = markdown.substring(
        node.position!.start.offset! + 2,
        node.position!.end.offset! - 2
      );
      const hasAlias =
        literalContent !== text && literalContent.includes(ALIAS_DIVIDER_CHAR);
      links.push({
        type: 'wikilink',
        slug: text.trim(),
        alias: hasAlias ? alias.trim() : null,
        literalContent,
        position: node.position!,
      });
    }

    if (node.type === 'definition') {
      linkDefinitions.push({
        label: node.label as string,
        url: node.url as string,
        title: node.title as string,
        position: node.position,
      });
    }
  });

  // Give precendence to the title from the frontmatter if it exists
  title = frontmatter.title ?? title;

  const end = tree.position!.end;
  const definitions = getFoamDefinitions(linkDefinitions, end);

  return {
    properties: frontmatter,
    slug: uriToSlug(uri),
    title: title,
    links: links,
    definitions: definitions,
    source: {
      uri: uri,
      text: markdown,
      contentStart: start,
      end: end,
      eol: eol,
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
  graph: NoteGraph,
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

  // if note doesn't exist, we can't find its links
  const note = graph.getNote(noteId);
  if (!note) {
    return [];
  }

  const forwardLinks = graph.getForwardLinks(noteId);

  // Try to generate a definition for each [[link]] in the note. 
  //
  // A note may have multiple [[link]] expressions to the same target
  // note with different aliases.s
  //
  // - note.links contains all the [[link]] expressions
  // - forwardLinks contains all the edges (links) between documents
  return (
    note.links
      .map(linkExpression => {

        // find the link between this and other document
        const link = forwardLinks.find(
          note => note.link.slug === linkExpression.slug
        );

        // if other document is not found, bail
        if (!link) {
          return null;
        }

        // find the target document
        let target = graph.getNote(link.to);

        // if we don't find the target by ID we search the graph by slug
        if (!target) {
          const candidates = graph.getNotes({ slug: linkExpression.slug });
          if (candidates.length > 1) {
            console.log(
              `Warning: Slug ${linkExpression.slug} matches ${candidates.length} documents. Picking one.`
            );
          }
          target = candidates.length > 0 ? candidates[0] : null;
        }

        // We are dropping links to non-existent notes here,
        // but in the future we may want to surface these too
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
          label: linkExpression.literalContent,
          url: pathToNote,
          title: linkExpression.alias || target.title || target.slug,
        };
      })

      // remove empty items
      .filter(Boolean)

      // sort by label, ascending
      .sort((a, b) => (a!.label < b!.label ? -1 : 1)) as NoteLinkDefinition[]
  );
}
