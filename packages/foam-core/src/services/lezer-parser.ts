import { GFM, parser as baseParser } from '@lezer/markdown';
import { SyntaxNodeRef, Tree } from '@lezer/common';
import { parse as parseYAML } from 'yaml';
import {
  BlockType,
  Footnote,
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
import { ParseObserver, ParserCache } from './markdown-parser';
import {
  findTagColumnInLine,
  getPropertiesInfoFromYAML,
} from './frontmatter-tags';
import { Wikilink, WIKILINK_NODE } from './lezer-wikilink';

/**
 * A {@link ResourceParser} built on `@lezer/markdown` instead of `remark-parse`.
 *
 * Motivation (issue #1689): remark-parse v8's tokenizer is quadratic in the size
 * of a list, so a single large outline note can take tens of seconds to parse
 * and blocks the extension host while it does. Every generation of the remark
 * ecosystem shares that behaviour; `@lezer/markdown` is linear, and it reports
 * character offsets for inline constructs, which is what Foam needs to build
 * {@link Range}s.
 *
 * ## How this differs from the remark parser structurally
 *
 * Lezer emits a flat tree of *marked* regions — text is whatever is not covered
 * by a node, so there are no text nodes to visit. Two consequences:
 *
 * - Hashtags are found by scanning the source and discarding matches that fall
 *   inside a region where a tag cannot occur (code, URLs, frontmatter). This is
 *   both simpler and more accurate than walking text nodes.
 * - Frontmatter is split off before parsing rather than parsed as a node, and
 *   node offsets are shifted back by the size of what was removed.
 */

// GFM matches `remark-parse`'s `{ gfm: true }`: tables, task lists,
// strikethrough and autolinks
const parser = baseParser.configure([GFM, Wikilink]);

/** Regions where a hashtag or a block anchor must not be recognised */
const OPAQUE_NODES = new Set([
  'InlineCode',
  'CodeText',
  'CodeMark',
  'CodeInfo',
  'URL',
  'LinkTitle',
  'LinkLabel',
  'Comment',
  'CommentBlock',
  'HTMLTag',
  'HTMLBlock',
]);

const HEADING_LEVELS: Record<string, number> = {
  ATXHeading1: 1,
  ATXHeading2: 2,
  ATXHeading3: 3,
  ATXHeading4: 4,
  ATXHeading5: 5,
  ATXHeading6: 6,
  SetextHeading1: 1,
  SetextHeading2: 2,
};

const BLOCK_NODE_TYPES: Record<string, BlockType> = {
  Paragraph: 'paragraph',
  ListItem: 'list-item',
  Blockquote: 'blockquote',
  ATXHeading1: 'heading',
  ATXHeading2: 'heading',
  ATXHeading3: 'heading',
  ATXHeading4: 'heading',
  ATXHeading5: 'heading',
  ATXHeading6: 'heading',
  SetextHeading1: 'heading',
  SetextHeading2: 'heading',
  Table: 'table',
};

/**
 * Blocks that swallow a full-line `^id` written directly underneath them: a
 * blockquote takes it as a lazy continuation, a GFM table as one more row.
 */
const ABSORBING_TYPES = new Set<BlockType>(['blockquote', 'table']);

/** Blocks where a full-line `^id` lands on a sibling line after the block */
const FULL_LINE_SIBLING_TYPES: Record<string, BlockType> = {
  FencedCode: 'code',
  CodeBlock: 'code',
  Table: 'table',
  Blockquote: 'blockquote',
};

const LIST_NODES = new Set(['BulletList', 'OrderedList']);

const BLOCK_ANCHOR_REGEX = /(\s)\^([a-zA-Z0-9-]+)$/;
const STANDALONE_BLOCK_ANCHOR_RE = /^\^([a-zA-Z0-9-]+)$/;
const FOOTNOTE_DEF_RE = /^[ ]{0,3}\[\^([^\]]+)\]:/;
const FOOTNOTE_REF_RE = /\[\^([^\]]+)\]/g;
// remark-frontmatter tolerates blank lines before the opening fence, and notes
// written from a template routinely start with one
const FRONTMATTER_RE =
  /^((?:[ \t]*\r?\n)*)---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Maps character offsets to {@link Position}s. Built once per parse; lookups
 * are a binary search over line starts.
 */
class LineIndex {
  private readonly starts: number[] = [0];

  constructor(private readonly text: string) {
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) {
        this.starts.push(i + 1);
      }
    }
  }

  /** Number of lines, counting a trailing newline as ending the last line */
  get lineCount(): number {
    return this.starts.length;
  }

  positionAt(offset: number): Position {
    let low = 0;
    let high = this.starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.starts[mid] <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return Position.create(low, offset - this.starts[low]);
  }

  rangeAt(from: number, to: number): Range {
    return Range.createFromPosition(this.positionAt(from), this.positionAt(to));
  }

  lineAt(line: number): string {
    const start = this.starts[line];
    if (start === undefined) {
      return '';
    }
    const end = this.starts[line + 1];
    return end === undefined
      ? this.text.slice(start)
      : this.text.slice(start, end).replace(/\r?\n$/, '');
  }
}

interface Frontmatter {
  properties: Record<string, unknown>;
  /** Offset in the source where the body (everything after frontmatter) starts */
  bodyStart: number;
  /** The YAML between the fences, or undefined when the note has none */
  yaml?: string;
  /** 0-based line of the opening `---` fence */
  fenceLine: number;
  /** Offsets of the `---`…`---` block itself, excluding any leading blank lines */
  blockFrom: number;
  blockTo: number;
}

function readFrontmatter(markdown: string, uri: URI): Frontmatter {
  const match = FRONTMATTER_RE.exec(markdown);
  if (!match) {
    return {
      properties: {},
      bodyStart: 0,
      fenceLine: 0,
      blockFrom: 0,
      blockTo: 0,
    };
  }
  let properties: Record<string, unknown> = {};
  try {
    properties = parseYAML(match[2]) ?? {};
  } catch (e) {
    Logger.warn(`Error while parsing YAML for [${uri.toString()}]`, e);
  }
  // a scalar or a list at the top level is not a property bag
  if (typeof properties !== 'object' || Array.isArray(properties)) {
    properties = {};
  }
  return {
    properties,
    bodyStart: match[0].length,
    yaml: match[2],
    fenceLine: (match[1].match(/\n/g) ?? []).length,
    blockFrom: match[1].length,
    blockTo: match[0].replace(/\r?\n$/, '').length,
  };
}

/** remark lowercases and collapses whitespace in reference identifiers */
const normalizeIdentifier = (label: string) =>
  label.replace(/\s+/g, ' ').trim().toLowerCase();

/** Syntax that is not part of a heading's visible label */
const LABEL_NOISE = new Set([
  'HeaderMark',
  'LinkMark',
  'WikilinkMark',
  'URL',
  'LinkTitle',
  'LinkLabel',
  'EmphasisMark',
  'CodeMark',
]);

/**
 * The visible text of a heading: `## A [[b|c]] and a [d](e)` → `A b and a d`.
 *
 * Matches how the remark parser builds titles and section labels — it collects
 * text and wikilink *targets*, so link URLs, aliases and emphasis markers are
 * dropped.
 */
function headingLabel(
  node: SyntaxNodeRef,
  source: string,
  shift: number
): string {
  // (from, to, replacement) for every region that is not plain text
  const edits: Array<[number, number, string]> = [];
  node.node.cursor().iterate(child => {
    const from = child.from + shift;
    const to = child.to + shift;
    if (child.name === WIKILINK_NODE) {
      const raw = source.slice(from, to);
      const inner = raw.slice(raw.startsWith('!') ? 3 : 2, -2);
      edits.push([from, to, inner.split('|')[0]]);
      return false; // its marks are already accounted for
    }
    if (LABEL_NOISE.has(child.name)) {
      edits.push([from, to, '']);
    }
    return undefined;
  });

  edits.sort((a, b) => a[0] - b[0]);
  let label = '';
  let cursor = node.from + shift;
  for (const [from, to, replacement] of edits) {
    if (from < cursor) {
      continue; // nested inside a region already replaced
    }
    label += source.slice(cursor, from) + replacement;
    cursor = to;
  }
  label += source.slice(cursor, node.to + shift);
  // a heading can carry a block anchor, which is not part of its label
  return label.trim().replace(/\s\^[a-zA-Z0-9-]+$/, '');
}

interface Walked {
  headings: Array<{ level: number; label: string; from: number; to: number }>;
  links: ResourceLink[];
  definitions: NoteLinkDefinition[];
  /** Regions where hashtags and block anchors must not be recognised */
  opaque: Array<[number, number]>;
  blocks: Array<{ type: BlockType; from: number; to: number; name: string }>;
  /** Direct children of every node, used for the sibling `^id` forms */
  siblings: Array<Array<{ name: string; from: number; to: number }>>;
}

function walk(
  tree: Tree,
  source: string,
  shift: number,
  uri: URI,
  lines: LineIndex
): Walked {
  const out: Walked = {
    headings: [],
    links: [],
    definitions: [],
    opaque: [],
    blocks: [],
    siblings: [],
  };
  // stack of child lists, so a node can look at its next sibling
  const childStack: Array<Array<{ name: string; from: number; to: number }>> = [
    [],
  ];

  const text = (from: number, to: number) => source.slice(from, to);

  tree.iterate({
    enter: (node: SyntaxNodeRef) => {
      const from = node.from + shift;
      const to = node.to + shift;
      const name = node.name;
      childStack[childStack.length - 1].push({ name, from, to });
      childStack.push([]);

      if (OPAQUE_NODES.has(name)) {
        out.opaque.push([from, to]);
      }

      const level = HEADING_LEVELS[name];
      if (level !== undefined) {
        out.headings.push({
          level,
          label: headingLabel(node, source, shift),
          from,
          to,
        });
      }

      const blockType = BLOCK_NODE_TYPES[name];
      if (blockType) {
        out.blocks.push({ type: blockType, from, to, name });
      }

      if (name === WIKILINK_NODE) {
        const raw = text(from, to);
        const isEmbed = raw.startsWith('!');
        const inner = raw.slice(isEmbed ? 3 : 2, -2);
        out.links.push({
          type: 'wikilink',
          rawText: raw,
          range: lines.rangeAt(from, to),
          isEmbed,
          definition: inner.split('|')[0],
        });
      }

      if (name === 'LinkReference') {
        // a definition: [label]: url "title"
        let label: string | undefined;
        let url = '';
        let title: string | undefined;
        node.node.cursor().iterate(child => {
          if (child.from === node.from && child.to === node.to) {
            return;
          }
          const value = text(child.from + shift, child.to + shift);
          if (child.name === 'LinkLabel' && label === undefined) {
            label = value.replace(/^\[|\]$/g, '');
          } else if (child.name === 'URL') {
            url = value.replace(/^<|>$/g, '');
          } else if (child.name === 'LinkTitle') {
            title = value.slice(1, -1);
          }
        });
        if (label !== undefined && !label.startsWith('^')) {
          out.definitions.push({
            label,
            url,
            title,
            range: lines.rangeAt(from, to),
          });
        }
        return false; // nothing inside a definition is a link
      }

      if (name === 'Link' || name === 'Image' || name === 'Autolink') {
        const raw = text(from, to);
        let url: string | undefined;
        let refLabel: string | undefined;
        let innerFrom = -1;
        let innerTo = -1;
        node.node.cursor().iterate(child => {
          if (child.from === node.from && child.to === node.to) {
            return;
          }
          if (child.name === 'URL' && url === undefined) {
            url = text(child.from + shift, child.to + shift).replace(
              /^<|>$/g,
              ''
            );
          } else if (child.name === 'LinkLabel' && refLabel === undefined) {
            refLabel = text(child.from + shift, child.to + shift).replace(
              /^\[|\]$/g,
              ''
            );
          } else if (child.name === 'LinkMark') {
            const markFrom = child.from + shift;
            const markTo = child.to + shift;
            if (innerFrom === -1 && source[markTo - 1] === '[') {
              innerFrom = markTo;
            } else if (innerTo === -1 && source[markFrom] === ']') {
              innerTo = markFrom;
            }
          }
        });

        if (name === 'Autolink') {
          out.links.push({
            type: 'external',
            rawText: raw,
            range: lines.rangeAt(from, to),
            isEmbed: false,
            definition: url ?? raw.slice(1, -1),
          });
          return;
        }

        if (url === undefined) {
          // reference style: [text][label] or the shortcut form [label]
          const identifier =
            refLabel !== undefined
              ? refLabel
              : innerFrom >= 0 && innerTo > innerFrom
              ? text(innerFrom, innerTo)
              : raw.replace(/^!?\[|\]$/g, '');
          if (identifier.startsWith('^')) {
            return; // a footnote reference, handled by the line scan
          }
          out.links.push({
            type: 'link',
            rawText: raw,
            range: lines.rangeAt(from, to),
            isEmbed: false,
            definition: normalizeIdentifier(identifier),
          });
          return;
        }

        const target = uri.resolve(url);
        if (target.path === uri.path) {
          return; // link to a section of this same note
        }
        out.links.push({
          type: target.scheme === 'file' ? 'link' : 'external',
          rawText: raw,
          range: lines.rangeAt(from, to),
          isEmbed: raw.startsWith('!'),
          ...(target.scheme === 'file' ? {} : { definition: url }),
        });
      }
      return undefined;
    },
    leave: () => {
      const children = childStack.pop();
      out.siblings.push(children);
    },
  });

  return out;
}

export function createLezerMarkdownParser(
  cache?: ParserCache,
  onParse?: ParseObserver
): ResourceParser {
  const parseNote = (uri: URI, markdown: string): Resource => {
    const lines = new LineIndex(markdown);
    const frontmatter = readFrontmatter(markdown, uri);
    const tree = parser.parse(markdown.slice(frontmatter.bodyStart));
    const walked = walk(tree, markdown, frontmatter.bodyStart, uri, lines);

    const note: Resource = {
      uri,
      type: 'note',
      properties: frontmatter.properties,
      title: '',
      sections: [],
      blocks: [],
      tags: [],
      aliases: [],
      links: walked.links,
      footnotes: [],
    };

    // ---- title -------------------------------------------------------------
    const firstH1 = walked.headings.find(h => h.level === 1 && h.label);
    note.title =
      frontmatter.properties.title?.toString() ??
      firstH1?.label ??
      uri.getName();

    // ---- sections ----------------------------------------------------------
    const stack: Array<{ label: string; level: number; headingRange: Range }> =
      [];
    for (const heading of walked.headings) {
      if (!heading.label || !heading.level) {
        continue;
      }
      const headingRange = lines.rangeAt(heading.from, heading.to);
      while (
        stack.length > 0 &&
        stack[stack.length - 1].level >= heading.level
      ) {
        const section = stack.pop();
        note.sections.push({
          label: section.label,
          level: section.level,
          range: Range.createFromPosition(
            section.headingRange.start,
            headingRange.start
          ),
          headingRange: section.headingRange,
        });
      }
      stack.push({
        label: heading.label,
        level: heading.level,
        headingRange,
      });
    }
    const documentEnd = Position.create(lines.lineCount, 0);
    while (stack.length > 0) {
      const section = stack.pop();
      note.sections.push({
        label: section.label,
        level: section.level,
        range: { start: section.headingRange.start, end: documentEnd },
        headingRange: section.headingRange,
      });
    }
    note.sections.sort((a, b) =>
      Position.compareTo(a.range.start, b.range.start)
    );

    // ---- tags --------------------------------------------------------------
    const opaque = walked.opaque.sort((a, b) => a[0] - b[0]);
    if (frontmatter.yaml !== undefined) {
      // a `#tag` in the YAML is a comment, and `tags:` is handled below
      opaque.unshift([0, frontmatter.bodyStart]);
    }
    const isOpaque = (offset: number) =>
      opaque.some(([from, to]) => offset >= from && offset < to);

    // frontmatter tags come first: the remark parser reports them while
    // visiting the yaml node, which precedes every text node
    if (isSome(frontmatter.properties.tags) && frontmatter.yaml !== undefined) {
      const info = getPropertiesInfoFromYAML(frontmatter.yaml)['tags'];
      if (info) {
        // the YAML starts on the line after the opening `---` fence
        const propertyStartLine = frontmatter.fenceLine + 1 + info.line;
        const propertyLines = info.text.split('\n');
        for (const tag of extractTagsFromProp(
          frontmatter.properties.tags as string | string[]
        )) {
          const offsetLine = propertyLines.findIndex(
            l => findTagColumnInLine(l, tag) >= 0
          );
          if (offsetLine < 0) {
            continue;
          }
          const line = propertyStartLine + offsetLine;
          const character = findTagColumnInLine(propertyLines[offsetLine], tag);
          note.tags.push({
            label: tag,
            range: Range.createFromPosition(
              Position.create(line, character),
              Position.create(line, character + tag.length)
            ),
          });
        }
      }
    }

    for (const tag of extractHashtags(markdown)) {
      if (isOpaque(tag.offset)) {
        continue;
      }
      const start = lines.positionAt(tag.offset);
      note.tags.push({
        label: tag.label,
        range: Range.createFromPosition(start, {
          line: start.line,
          character: start.character + tag.label.length + 1,
        }),
      });
    }

    // ---- aliases -----------------------------------------------------------
    if (
      isSome(frontmatter.properties.alias) &&
      frontmatter.yaml !== undefined
    ) {
      const raw = frontmatter.properties.alias as string | string[];
      const aliases = Array.isArray(raw)
        ? raw
        : String(raw)
            .split(',')
            .map(a => a.trim());
      const frontmatterRange = lines.rangeAt(
        frontmatter.blockFrom,
        frontmatter.blockTo
      );
      for (const alias of aliases) {
        note.aliases.push({ title: alias, range: frontmatterRange });
      }
    }

    // ---- block anchors -----------------------------------------------------
    collectBlocks(note, walked, markdown, lines);

    // ---- reference resolution ---------------------------------------------
    for (const link of note.links) {
      if (!ResourceLink.isUnresolvedReference(link)) {
        continue;
      }
      const referenceId = link.definition;
      const definition = walked.definitions.find(d => d.label === referenceId);
      (link as { definition: string | NoteLinkDefinition }).definition =
        definition || referenceId;
      if (definition && link.type === 'link') {
        const resolved = URI.parse(definition.url, 'tmp');
        if (resolved.scheme !== 'file' && resolved.scheme !== 'tmp') {
          (link as { type: ResourceLink['type'] }).type = 'external';
        }
      }
    }
    note.links = note.links.filter(
      link =>
        link.type === 'wikilink' ||
        link.type === 'external' ||
        !ResourceLink.isUnresolvedReference(link)
    );

    // ---- footnotes ---------------------------------------------------------
    note.footnotes = collectFootnotes(markdown);

    return note;
  };

  const uncached: ResourceParser = {
    parse: (uri, markdown) => {
      const start = performance.now();
      const resource = parseNote(uri, markdown);
      onParse?.({
        uri,
        chars: markdown.length,
        ms: performance.now() - start,
        cacheHit: false,
      });
      return resource;
    },
  };

  if (!isSome(cache)) {
    return onParse ? uncached : { parse: parseNote };
  }

  return {
    parse: (uri, markdown) => {
      const start = performance.now();
      const checksum = hash(markdown);
      if (cache.has(uri)) {
        const entry = cache.get(uri);
        if (entry.checksum === checksum) {
          onParse?.({
            uri,
            chars: markdown.length,
            ms: performance.now() - start,
            cacheHit: true,
          });
          return entry.resource;
        }
      }
      const resource = parseNote(uri, markdown);
      cache.set(uri, { checksum, resource });
      onParse?.({
        uri,
        chars: markdown.length,
        ms: performance.now() - start,
        cacheHit: false,
      });
      return resource;
    },
  };
}

function collectBlocks(
  note: Resource,
  walked: Walked,
  source: string,
  lines: LineIndex
): void {
  const seen = new Set<string>();

  for (const block of walked.blocks) {
    const absorbed = absorbedAnchor(source, block.from, block.to);
    if (absorbed) {
      // the anchor is on its own line and the block swallowed it
      if (ABSORBING_TYPES.has(block.type) && !seen.has(absorbed.id)) {
        seen.add(absorbed.id);
        note.blocks.push({
          id: absorbed.id,
          type: block.type,
          range: lines.rangeAt(block.from, absorbed.contentTo),
          markerRange: lines.rangeAt(
            absorbed.markerFrom,
            absorbed.markerFrom + absorbed.id.length + 1
          ),
        });
      }
      // for a paragraph or list item the anchor belongs to the enclosing
      // list, which is handled in the sibling pass below
      continue;
    }

    const text = directText(block, source);
    const match = BLOCK_ANCHOR_REGEX.exec(text);
    if (!match) {
      continue;
    }
    const [, , id] = match;
    const startLine = lines.positionAt(block.from).line;
    if (
      note.blocks.some(b => b.id === id && b.range.start.line === startLine)
    ) {
      continue;
    }

    const markerOffset = block.to - (id.length + 1);
    note.blocks.push({
      id,
      type: block.type,
      range: lines.rangeAt(block.from, block.to),
      markerRange: lines.rangeAt(markerOffset, block.to),
    });
    seen.add(id);
  }

  // full-line `^id` following a code fence, table or blockquote, and the form
  // absorbed into the last item of a list
  for (const children of walked.siblings) {
    for (let i = 0; i < children.length; i++) {
      const current = children[i];
      const siblingType = FULL_LINE_SIBLING_TYPES[current.name];
      if (siblingType) {
        const next = children[i + 1];
        if (next?.name === 'Paragraph') {
          const gap = source.slice(current.to, next.from);
          if ((gap.match(/\n/g)?.length ?? 0) <= 2) {
            const idMatch = STANDALONE_BLOCK_ANCHOR_RE.exec(
              source.slice(next.from, next.to).trim()
            );
            if (idMatch && !seen.has(idMatch[1])) {
              const id = idMatch[1];
              seen.add(id);
              note.blocks.push({
                id,
                type: siblingType,
                range: lines.rangeAt(current.from, current.to),
                markerRange: lines.rangeAt(
                  next.from,
                  next.from + id.length + 1
                ),
              });
            }
          }
        }
      }

      if (LIST_NODES.has(current.name)) {
        const text = source.slice(current.from, current.to);
        const idMatch = /\n\^([a-zA-Z0-9-]+)\s*$/.exec(text);
        if (!idMatch || seen.has(idMatch[1])) {
          continue;
        }
        const id = idMatch[1];
        seen.add(id);
        const markerOffset = current.from + idMatch.index + 1;
        note.blocks.push({
          id,
          type: 'list',
          range: lines.rangeAt(current.from, markerOffset - 1),
          markerRange: lines.rangeAt(
            markerOffset,
            markerOffset + id.length + 1
          ),
        });
      }
    }
  }
}

/**
 * A `^id` written on its own line directly under a block, which the block then
 * swallowed — as a lazy continuation (blockquote, paragraph, list item) or as a
 * final row (GFM table).
 *
 * Returns where the block's real content ends and where the marker starts, so
 * the `^id` line can be kept out of the block's range.
 */
function absorbedAnchor(
  source: string,
  from: number,
  to: number
): { id: string; contentTo: number; markerFrom: number } | null {
  const text = source.slice(from, to);
  const lastBreak = text.lastIndexOf('\n');
  if (lastBreak < 0) {
    return null;
  }
  // the leading group covers a blockquote's `> ` prefix and any indentation
  const match = /^([ \t]*(?:>[ \t]*)?)\^([a-zA-Z0-9-]+)[ \t]*$/.exec(
    text.slice(lastBreak + 1)
  );
  if (!match) {
    return null;
  }
  return {
    id: match[2],
    contentTo: from + lastBreak,
    markerFrom: from + lastBreak + 1 + match[1].length,
  };
}

/**
 * The text of a block, without descending into nested blocks. For a list item
 * only the first paragraph counts, so that an anchor on a sub-item is not
 * attributed to its parent.
 */
function directText(
  block: { from: number; to: number; type: BlockType },
  source: string
): string {
  const text = source.slice(block.from, block.to);
  if (block.type !== 'list-item') {
    return text;
  }
  // stop at the first line that starts a nested list
  const lines = text.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && /^\s+([-*+]|\d+[.)])\s/.test(lines[i])) {
      break;
    }
    out.push(lines[i]);
  }
  return out.join('\n');
}

function collectFootnotes(markdown: string): Footnote[] {
  const footnotes = new Map<string, Footnote>();
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const defMatch = line.match(FOOTNOTE_DEF_RE);
    if (defMatch) {
      const id = defMatch[1];
      const existing = footnotes.get(id);
      if (existing) {
        existing.definitionRange ??= Range.create(i, 0, i, line.length);
      } else {
        footnotes.set(id, {
          id,
          definitionRange: Range.create(i, 0, i, line.length),
          references: [],
        });
      }
      continue;
    }
    FOOTNOTE_REF_RE.lastIndex = 0;
    let match: RegExpExecArray;
    while ((match = FOOTNOTE_REF_RE.exec(line)) !== null) {
      const id = match[1];
      const ref = Range.create(
        i,
        match.index,
        i,
        match.index + match[0].length
      );
      const entry = footnotes.get(id);
      if (entry) {
        entry.references.push(ref);
      } else {
        footnotes.set(id, { id, definitionRange: null, references: [ref] });
      }
    }
  }
  return Array.from(footnotes.values());
}
