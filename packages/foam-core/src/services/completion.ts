import { extractHashtags, extractTagsFromProp } from '../utils/hashtags';
import { getYAMLKey, isInFrontMatter, isOnYAMLKeywordLine } from '../utils/md';

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

/** A tag word in a YAML value, after a separator, with any `#` before it */
const YAML_TAG = /(?:^|[\s,["'])(#?)([^\s,["'#]*)$/;

/**
 * What is being typed at `offset` in `text`: a wikilink, section, block
 * anchor or tag as core reads one once it is closed, or a tag in the value
 * of the frontmatter's `tags`. Only the cursor's line and the frontmatter
 * before it are read, so code spans and blocks are not told from text.
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
  const open = openLinkAt(line);
  if (open >= 0) {
    return linkContext(line.slice(open + 2), lineStart + open);
  }
  // `x` is a character yet to be typed, so that `#` alone reads as a tag
  const tag = extractHashtags(`${line}x`).find(
    tag => tag.offset + 1 + tag.label.length === line.length + 1
  );
  return tag
    ? {
        kind: 'tag',
        query: tag.label.slice(0, -1),
        start: lineStart + tag.offset,
        frontmatter: false,
      }
    : null;
}

/**
 * Where the wikilink being typed on `line` opens, as core's parser reads
 * one: at the first `[[` after the last `]]` that no backslash escapes.
 */
function openLinkAt(line: string): number {
  const closed = line.lastIndexOf(']]');
  let open = line.indexOf('[[', closed < 0 ? 0 : closed + 2);
  while (open >= 0 && /(^|[^\\])(\\\\)*\\$/.test(line.slice(0, open))) {
    open = line.indexOf('[[', open + 1);
  }
  return open;
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
  // Below its key, a value goes on indented lines and list items; a `-`
  // alone opens a list item, whose value starts after its space
  const inValue = getYAMLKey(line) !== undefined || /^(\s|-\s)/.test(line);
  if (!inValue || /^\s*-$/.test(line) || !isOnYAMLKeywordLine(before, 'tags')) {
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
