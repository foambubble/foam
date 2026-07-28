/**
 * Locating frontmatter tags in the source, shared by every
 * {@link ResourceParser} implementation.
 *
 * YAML parsing gives us the tag *values* but not where they sit in the
 * document, and Foam needs a {@link Range} for each one. Recovering that means
 * scanning the raw YAML, which is fiddly enough — quoted keys, multi-line
 * values, tags that are prefixes of other tags — that both parsers should share
 * one implementation rather than drift apart.
 */

// Matches a top-level YAML key: starts at column 0 with a non-hyphen, non-space,
// non-comment character, and contains a colon (e.g. "tags:", "date-created:").
const YAML_KEY_LINE_RE = /^([^-\s#][^:]*?):\s*(.*)/;

export interface YamlPropertyInfo {
  key: string;
  value: string;
  /** The key's line plus any continuation lines */
  text: string;
  /** 0-based line of the key, relative to the start of the YAML block */
  line: number;
}

/**
 * Every top-level key in a YAML block, with the lines it spans, so a property's
 * position in the original document can be recovered.
 */
export function getPropertiesInfoFromYAML(yamlText: string): {
  [key: string]: YamlPropertyInfo;
} {
  const lines = yamlText.split('\n');
  const result: { [key: string]: YamlPropertyInfo } = {};
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const match = lines[lineIdx].match(YAML_KEY_LINE_RE);
    if (!match) {
      continue;
    }
    // YAML allows quoted keys ("tags": ...) — normalize to the plain name
    const key = match[1].replace(/^(["'])(.*)\1$/, '$2');
    let text = lines[lineIdx];
    let j = lineIdx + 1;
    // Collect continuation lines: everything that isn't the start of a new key
    while (j < lines.length && !YAML_KEY_LINE_RE.test(lines[j])) {
      text += '\n' + lines[j];
      j++;
    }
    const value = text.slice(key.length + 1).trim();
    result[key] = { key, value, text, line: lineIdx };
  }
  return result;
}

/** Characters that can be part of a tag label (see HASHTAG_REGEX) */
const TAG_LABEL_CHAR = /[\p{L}\p{Extended_Pictographic}\p{N}/_-]/u;

/**
 * Finds the column of `tag` in `line`, matching only occurrences that are not
 * part of a longer tag-like word (so tag `foo` does not match inside `foobar`)
 */
export const findTagColumnInLine = (line: string, tag: string): number => {
  for (
    let idx = line.indexOf(tag);
    idx >= 0;
    idx = line.indexOf(tag, idx + 1)
  ) {
    const before = idx > 0 ? line[idx - 1] : '';
    const after = idx + tag.length < line.length ? line[idx + tag.length] : '';
    if (!TAG_LABEL_CHAR.test(before) && !TAG_LABEL_CHAR.test(after)) {
      return idx;
    }
  }
  return -1;
};
