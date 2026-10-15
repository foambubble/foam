import { Position } from '../model/position';
import { URI } from '../model/uri';
import { extractTagsFromProp } from '../utils/hashtags';
import { isInFrontMatter, isOnYAMLKeywordLine } from '../utils/md';
import { createMarkdownParser } from './markdown-parser';

/**
 * What is being typed at a cursor: a wikilink, a section or block anchor in
 * one, or a tag. `query` is what has been typed of it, up to the cursor;
 * `start` is the offset of its `[[` or `#`.
 */
export type CompletionContext =
  | { kind: 'link'; query: string; start: number }
  | {
      kind: 'section' | 'block';
      /** The note it is in, empty for the note being edited */
      target: string;
      query: string;
      start: number;
    }
  | {
      kind: 'tag';
      query: string;
      /** Its first character when typed without `#` */
      start: number;
      /** In the frontmatter's `tags`, where a tag is written without `#` */
      frontmatter: boolean;
    };

const parser = createMarkdownParser();
const probeUri = URI.placeholder('completion');

/** A tag word in a YAML value, after a separator, with any `#` before it */
const YAML_TAG = /(?:^|[\s,["'])(#?)([^\s,["'#]*)$/;

/**
 * What is being typed at `offset` in `text`: a wikilink, section, block
 * anchor or tag that core's parser reads once it is closed, or a tag in the
 * value of the frontmatter's `tags`. Only the text before `offset` is read.
 */
export function completionAt(
  text: string,
  offset: number
): CompletionContext | null {
  const before = text.slice(0, offset);
  const lineStart = before.lastIndexOf('\n') + 1;
  const line = before.slice(lineStart);
  const lineNumber = before.split('\n').length - 1;
  if (isInFrontMatter(before, lineNumber)) {
    return frontMatterTagAt(before, line, lineStart);
  }
  const typingLink = line.lastIndexOf('[[') > line.lastIndexOf(']]');
  if (!typingLink && !/#\S*$/.test(line)) {
    return null;
  }
  // `x` is a character yet to be typed, so that `[[` and `#` alone read as a
  // link and a tag; the backtick closes a code span open at the cursor, so
  // that what is typed in it reads as code.
  const probe = parser.parse(probeUri, `${before}x]]\``);
  const endsAt = (position: Position, length: number) =>
    Position.isEqual(
      position,
      Position.create(lineNumber, line.length + length)
    );
  const link = probe.links.find(
    link => link.type === 'wikilink' && endsAt(link.range.end, 'x]]'.length)
  );
  if (link) {
    // An embed's range starts at its `!`
    const start =
      lineStart + link.range.start.character + (link.isEmbed ? 1 : 0);
    return linkContext(before.slice(start + 2), start);
  }
  const tag = probe.tags.find(tag => endsAt(tag.range.end, 'x'.length));
  if (tag) {
    const start = lineStart + tag.range.start.character;
    return {
      kind: 'tag',
      query: before.slice(start + 1),
      start,
      frontmatter: false,
    };
  }
  return null;
}

/** What is typed of a wikilink opening at `start`, split as core splits one. */
function linkContext(typed: string, start: number): CompletionContext | null {
  // Past a `|` is the alias, which is free text
  if (typed.includes('|')) {
    return null;
  }
  const hash = typed.indexOf('#');
  if (hash < 0) {
    return { kind: 'link', query: typed, start };
  }
  const target = typed.slice(0, hash);
  const fragment = typed.slice(hash + 1);
  return fragment.startsWith('^')
    ? { kind: 'block', target, query: fragment.slice(1), start }
    : { kind: 'section', target, query: fragment, start };
}

function frontMatterTagAt(
  before: string,
  line: string,
  lineStart: number
): CompletionContext | null {
  // A `-` alone opens a list item, whose value starts after its space
  if (!isOnYAMLKeywordLine(before, 'tags') || /^\s*-$/.test(line)) {
    return null;
  }
  const match = YAML_TAG.exec(line);
  if (!match) {
    return null;
  }
  const [, hash, query] = match;
  // With a character yet to be typed, the word must read back whole as a tag
  const read = extractTagsFromProp(`${query}x`);
  if (read.length !== 1 || read[0] !== `${query}x`) {
    return null;
  }
  return {
    kind: 'tag',
    query,
    start: lineStart + line.length - query.length - hash.length,
    frontmatter: true,
  };
}
