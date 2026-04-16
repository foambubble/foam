import { describe, it, expect } from 'vitest';
import { matchesGroup, resolveGroupColor } from './groups';
import { makeNode } from '../test-utils';
import type { GroupRule } from '../protocol';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeRule = (
  property: string,
  value: string,
  overrides: Partial<GroupRule> = {}
): GroupRule => ({
  id: 'r1',
  label: `${property}=${value}`,
  color: '#ff0000',
  enabled: true,
  match: { property, value },
  ...overrides,
});

// ---------------------------------------------------------------------------
// matchesGroup — type
// ---------------------------------------------------------------------------

describe('matchesGroup — type property', () => {
  it('matches exact type', () => {
    const node = makeNode({ type: 'project' });
    expect(matchesGroup(node, makeRule('type', 'project'))).toBe(true);
  });

  it('does not match different type', () => {
    const node = makeNode({ type: 'note' });
    expect(matchesGroup(node, makeRule('type', 'project'))).toBe(false);
  });

  it('matches type with regex', () => {
    const node = makeNode({ type: 'project' });
    expect(matchesGroup(node, makeRule('type', '/proj.*/'))).toBe(true);
  });

  it('does not match type with non-matching regex', () => {
    const node = makeNode({ type: 'note' });
    expect(matchesGroup(node, makeRule('type', '/proj.*/'))).toBe(false);
  });

  it('invalid regex falls back to exact match', () => {
    const node = makeNode({ type: '/proj' });
    // "/proj" is not a valid /regex/ wrapper (no closing slash), treated as exact
    expect(matchesGroup(node, makeRule('type', '/proj'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// matchesGroup — path
// ---------------------------------------------------------------------------

describe('matchesGroup — path property', () => {
  it('matches path by substring', () => {
    const node = makeNode({ id: '/work/journal/note.md' });
    expect(matchesGroup(node, makeRule('path', 'journal'))).toBe(true);
  });

  it('does not match when substring is absent', () => {
    const node = makeNode({ id: '/work/projects/note.md' });
    expect(matchesGroup(node, makeRule('path', 'journal'))).toBe(false);
  });

  it('matches path with regex', () => {
    const node = makeNode({ id: '/work/2024-01-15.md' });
    expect(matchesGroup(node, makeRule('path', '/\\d{4}-\\d{2}-\\d{2}/'))).toBe(true);
  });

  it('does not match path with non-matching regex', () => {
    const node = makeNode({ id: '/work/project-a.md' });
    expect(matchesGroup(node, makeRule('path', '/\\d{4}-\\d{2}-\\d{2}/'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// matchesGroup — title
// ---------------------------------------------------------------------------

describe('matchesGroup — title property', () => {
  it('matches title by substring', () => {
    const node = makeNode({ title: 'My Daily Note' });
    expect(matchesGroup(node, makeRule('title', 'Daily'))).toBe(true);
  });

  it('does not match when substring is absent', () => {
    const node = makeNode({ title: 'Project Alpha' });
    expect(matchesGroup(node, makeRule('title', 'Daily'))).toBe(false);
  });

  it('matches title with regex', () => {
    const node = makeNode({ title: '2024-01-15' });
    expect(matchesGroup(node, makeRule('title', '/^\\d{4}/'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// matchesGroup — tag
// ---------------------------------------------------------------------------

describe('matchesGroup — tag property', () => {
  it('matches when node has the exact tag', () => {
    const node = makeNode({ tags: [{ label: 'work' }, { label: 'daily' }] });
    expect(matchesGroup(node, makeRule('tag', 'work'))).toBe(true);
  });

  it('does not match when node lacks the tag', () => {
    const node = makeNode({ tags: [{ label: 'personal' }] });
    expect(matchesGroup(node, makeRule('tag', 'work'))).toBe(false);
  });

  it('does not match when node has no tags', () => {
    const node = makeNode({ tags: [] });
    expect(matchesGroup(node, makeRule('tag', 'work'))).toBe(false);
  });

  it('matches tag with regex', () => {
    const node = makeNode({ tags: [{ label: 'project/alpha' }] });
    expect(matchesGroup(node, makeRule('tag', '/^project/'))).toBe(true);
  });

  it('does not match tag with non-matching regex', () => {
    const node = makeNode({ tags: [{ label: 'personal' }] });
    expect(matchesGroup(node, makeRule('tag', '/^project/'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// matchesGroup — custom frontmatter property
// ---------------------------------------------------------------------------

describe('matchesGroup — custom frontmatter property', () => {
  it('matches exact value of a custom property', () => {
    const node = makeNode({ properties: { status: 'active' } });
    expect(matchesGroup(node, makeRule('status', 'active'))).toBe(true);
  });

  it('does not match different value of a custom property', () => {
    const node = makeNode({ properties: { status: 'archived' } });
    expect(matchesGroup(node, makeRule('status', 'active'))).toBe(false);
  });

  it('does not match when the custom property is absent', () => {
    const node = makeNode({ properties: {} });
    expect(matchesGroup(node, makeRule('status', 'active'))).toBe(false);
  });

  it('matches custom property with regex', () => {
    const node = makeNode({ properties: { status: 'in-progress' } });
    expect(matchesGroup(node, makeRule('status', '/^in-/'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveGroupColor — layering and precedence
// ---------------------------------------------------------------------------

describe('resolveGroupColor', () => {
  const node = makeNode({ type: 'project', id: '/work/project-a.md' });

  it('returns undefined when no groups are defined', () => {
    expect(resolveGroupColor(node, [])).toBeUndefined();
  });

  it('returns undefined when no group matches', () => {
    const groups = [makeRule('type', 'note')];
    expect(resolveGroupColor(node, groups)).toBeUndefined();
  });

  it('returns the color of a matching enabled group', () => {
    const groups = [makeRule('type', 'project', { color: '#aabbcc' })];
    expect(resolveGroupColor(node, groups)).toBe('#aabbcc');
  });

  it('returns undefined for a matching but disabled group', () => {
    const groups = [makeRule('type', 'project', { color: '#aabbcc', enabled: false })];
    expect(resolveGroupColor(node, groups)).toBeUndefined();
  });

  it('last matching group wins when multiple groups match', () => {
    const groups = [
      makeRule('type', 'project', { id: 'g1', color: '#111111' }),
      makeRule('path', 'work',    { id: 'g2', color: '#222222' }),
    ];
    // both match — g2 comes last so its color wins
    expect(resolveGroupColor(node, groups)).toBe('#222222');
  });

  it('skips disabled groups when computing last-match winner', () => {
    const groups = [
      makeRule('type', 'project', { id: 'g1', color: '#111111' }),
      makeRule('path', 'work',    { id: 'g2', color: '#222222', enabled: false }),
    ];
    // g2 matches but is disabled — g1 wins
    expect(resolveGroupColor(node, groups)).toBe('#111111');
  });

  it('a non-matching group does not affect the result', () => {
    const groups = [
      makeRule('type', 'note',    { id: 'g1', color: '#111111' }),
      makeRule('type', 'project', { id: 'g2', color: '#222222' }),
    ];
    // g1 does not match (node is 'project'), g2 does
    expect(resolveGroupColor(node, groups)).toBe('#222222');
  });
});
