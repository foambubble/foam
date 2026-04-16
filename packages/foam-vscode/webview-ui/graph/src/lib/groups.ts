import type { AugmentedNode } from './types';
import type { GroupRule } from '../protocol';

/**
 * Parses a match value: if wrapped in /…/, treats it as a regex.
 * Otherwise returns a predicate for exact match.
 * Invalid regex falls back to exact match.
 */
function makeRegexMatcher(value: string): ((s: string) => boolean) | null {
  const m = value.match(/^\/(.*)\/([gimsuy]*)$/);
  if (m) {
    try {
      const re = new RegExp(m[1], m[2]);
      return s => re.test(s);
    } catch {
      // Invalid regex — caller falls back to default
    }
  }
  return null;
}

export function matchesGroup(node: AugmentedNode, rule: GroupRule): boolean {
  const { property, value } = rule.match;
  const regex = makeRegexMatcher(value);
  switch (property) {
    case 'type':
      return regex ? regex(node.type) : node.type === value;
    case 'path':
      return regex ? regex(node.id) : node.id.includes(value);
    case 'tag':
      return node.tags?.some(t => regex ? regex(t.label) : t.label === value) ?? false;
    case 'title':
      return regex ? regex(node.title) : node.title.includes(value);
    default:
      return regex
        ? regex(String(node.properties[property] ?? ''))
        : node.properties[property] === value;
  }
}

/**
 * Returns the color of the last enabled group that matches the node.
 * Last match wins — more specific rules should be placed later in the list.
 */
export function resolveGroupColor(
  node: AugmentedNode,
  groups: GroupRule[]
): string | undefined {
  let color: string | undefined;
  for (const group of groups) {
    if (group.enabled && matchesGroup(node, group)) {
      color = group.color;
    }
  }
  return color;
}
