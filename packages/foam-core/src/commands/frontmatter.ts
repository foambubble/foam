import matter from 'gray-matter';

export interface FrontmatterResult {
  /** Parsed frontmatter properties (empty object if no frontmatter present) */
  properties: Record<string, any>;
  /** The note body without the frontmatter block */
  body: string;
  /** True if the source had a frontmatter block */
  hasFrontmatter: boolean;
}

/**
 * Parses the YAML frontmatter from a markdown string.
 */
export function parseFrontmatter(content: string): FrontmatterResult {
  const parsed = matter(content);
  // gray-matter exposes the raw frontmatter block as `parsed.matter` — but
  // it's a non-enumerable property, and gray-matter's internal cache returns
  // an Object.assign copy on hits, which strips non-enumerable fields. So
  // `parsed.matter` is undefined on cache hits even when frontmatter exists.
  // Fall back to inferring presence from `parsed.data`, which is always
  // populated when frontmatter parsed successfully.
  const matterText = (parsed as { matter?: string }).matter ?? '';
  const hasFrontmatter =
    matterText.trim().length > 0 ||
    (parsed.data !== undefined && Object.keys(parsed.data).length > 0);
  return {
    properties: parsed.data ?? {},
    body: parsed.content,
    hasFrontmatter,
  };
}

/**
 * Serializes properties + body back to a markdown string with a YAML
 * frontmatter block. If `properties` is empty and the original content had
 * no frontmatter, returns the body unchanged.
 */
export function stringifyFrontmatter(
  body: string,
  properties: Record<string, any>
): string {
  if (Object.keys(properties).length === 0) {
    return body;
  }
  return matter.stringify(body, properties);
}

/**
 * Merges new properties into an existing markdown content's frontmatter.
 *
 * If `mode` is `'merge'` (default), keys in `newProperties` override
 * existing keys but other existing keys are preserved.
 * If `mode` is `'replace'`, the entire frontmatter block is replaced.
 */
export function mergeFrontmatter(
  content: string,
  newProperties: Record<string, any>,
  mode: 'merge' | 'replace' = 'merge'
): string {
  const { properties, body } = parseFrontmatter(content);
  const merged =
    mode === 'replace' ? newProperties : { ...properties, ...newProperties };
  return stringifyFrontmatter(body, merged);
}

/**
 * Returns the existing tags array from frontmatter, or an empty array.
 * Handles both YAML list (`tags: [a, b]`) and comma-separated string
 * (`tags: a, b`) representations.
 */
function readTags(properties: Record<string, any>): string[] {
  const raw = properties.tags;
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  return [];
}

/**
 * Adds tags to a note's frontmatter (deduplicating). Returns the updated
 * markdown content and the resulting tag list.
 */
export function addTagsToFrontmatter(
  content: string,
  tagsToAdd: string[]
): { content: string; tags: string[] } {
  const { properties, body } = parseFrontmatter(content);
  const existing = readTags(properties);
  const next = Array.from(new Set([...existing, ...tagsToAdd]));
  const updated = stringifyFrontmatter(body, { ...properties, tags: next });
  return { content: updated, tags: next };
}

/**
 * Removes tags from a note's frontmatter. Returns the updated markdown
 * content and the resulting tag list.
 */
export function removeTagsFromFrontmatter(
  content: string,
  tagsToRemove: string[]
): { content: string; tags: string[] } {
  const { properties, body } = parseFrontmatter(content);
  const existing = readTags(properties);
  const removeSet = new Set(tagsToRemove);
  const next = existing.filter(t => !removeSet.has(t));
  const updated = stringifyFrontmatter(body, { ...properties, tags: next });
  return { content: updated, tags: next };
}
