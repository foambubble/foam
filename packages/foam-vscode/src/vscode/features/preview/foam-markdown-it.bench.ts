import { bench, describe } from 'vitest';
import { createMarkdownParser, FoamGraph, Resource, URI } from '@foam/core';
import { createTestWorkspace, createTestNote } from '@foam/core/test';
import { createFoamMarkdownIt } from './foam-markdown-it';

/**
 * Scaling benchmark for the FULL preview render pipeline — every Foam markdown-it
 * plugin composed by `createFoamMarkdownIt` (pipe-escape, footnotes, embed,
 * tags, navigation, reference cleanup, block anchors, foam-query).
 *
 * It measures two independent axes, because different plugins scale on different
 * things (see #1689):
 *   - **note size**: how render cost grows with the document being rendered.
 *     Guards against per-line/per-char O(n²) hotspots like the one in #1689.
 *   - **workspace size**: several plugins (navigation, embed, tags, query)
 *     consult the workspace + graph per link, so their cost can grow with the
 *     NUMBER OF NOTES independent of the rendered document's size.
 *
 * The whole pipeline is vscode-free (plugins take @foam/core types + plain
 * callbacks), so this runs as a clean `vitest bench` in node. Regressions are
 * enforced by `perf-regression.test.ts` against a baseline.
 */

const parser = createMarkdownParser([]);

/** A no-op link renderer — the pipeline only needs the shape, not vscode. */
const linkResolver = () => ({});

/** Builds a markdown-it with the full Foam pipeline over the given fixture. */
function buildPipeline(notes: Resource[], current: Resource) {
  const workspace = createTestWorkspace();
  for (const n of notes) {
    workspace.set(n);
  }
  const graph = FoamGraph.fromWorkspace(workspace);
  return createFoamMarkdownIt({
    workspace,
    graph,
    parser,
    linkResolver,
    getCurrentResource: () => current,
    toHref: (uri: URI) => uri.path,
  });
}

/** A workspace of N interlinked notes, so link resolution has real work. */
function makeWorkspaceNotes(count: number): Resource[] {
  return Array.from({ length: count }, (_, i) =>
    createTestNote({
      uri: `/notes/note-${i}.md`,
      title: `Note ${i}`,
      links: [{ slug: `note-${(i + 1) % count}` }],
    })
  );
}

/** A realistic note body: list items, wikilinks (some piped), tags, headings. */
function makeNoteBody(lines: number): string {
  const out = ['# Daily Note', ''];
  for (let i = 0; i < lines; i++) {
    if (i % 25 === 0) out.push(`## Section ${i / 25}`);
    if (i % 4 === 0) {
      out.push(`- [[note-${i % 50}|alias ${i}]] and [[note-${(i + 3) % 50}]] #work`);
    } else {
      out.push(`- line ${i} with ordinary prose and a bit of length to render`);
    }
  }
  return out.join('\n');
}

// ── Axis 1: note size (small fixed workspace) ────────────────────────────────
// [linear]: doubling the note size should ~double render time.
describe('preview pipeline — note size [linear]', () => {
  const wsNotes = makeWorkspaceNotes(50);
  const current = createTestNote({ uri: '/notes/current.md' });
  const md = buildPipeline(wsNotes, current);

  for (const lines of [500, 1000, 2000, 4000]) {
    const doc = makeNoteBody(lines);
    bench(`${lines} lines`, () => {
      md.render(doc);
    });
  }
});

// ── Axis 2: workspace size (fixed 500-line note) ─────────────────────────────
// [flat]: render cost of a fixed note should not grow with workspace size
// (per-link lookups are O(1) via the reversed trie).
describe('preview pipeline — workspace size [flat]', () => {
  const doc = makeNoteBody(500);

  for (const notes of [100, 500, 2000, 10000]) {
    const wsNotes = makeWorkspaceNotes(notes);
    const current = createTestNote({ uri: '/notes/current.md' });
    const md = buildPipeline(wsNotes, current);
    bench(`${notes} notes`, () => {
      md.render(doc);
    });
  }
});
