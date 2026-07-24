import { bench, describe } from 'vitest';
import { FoamWorkspace } from './workspace';
import { FoamGraph } from './graph';
import { Resource } from './note';
import { Range } from './range';
import { URI } from './uri';
import { createTestWorkspace } from '../../test/test-utils';

/**
 * Performance benchmark for the "large repository" bottleneck (see #1375).
 *
 * This is the second known perf axis (the first, big single note, lives in
 * `markdown-parser.bench.ts`). pderaaij's investigation pointed at two costs
 * that grow with note count: the O(n) identifier scan (`listByIdentifier`) hit
 * during link resolution, and `FoamGraph.update()` — which clears and rebuilds
 * the ENTIRE graph (every resource × every link) on any change, rather than
 * updating incrementally.
 *
 * We measure three operations across repo sizes:
 *   - workspace build — set N notes into the workspace
 *   - graph build     — FoamGraph.fromWorkspace (resolve every link once)
 *   - graph update    — a single note change triggering a full graph rebuild
 *                       (this is what runs on every save in a large repo)
 *
 */

/** Repo sizes we track, in number of notes. */
export const REPO_BENCHMARK_SIZES = [100, 500, 1000, 5000, 10000];

function makeNote(i: number, total: number): Resource {
  const targets = [
    (i + 1) % total,
    (i + 7) % total,
    (i + 13) % total,
    (i * 3 + 1) % total,
  ];
  return {
    uri: URI.file(`/repo/note-${i}.md`),
    type: 'note',
    properties: {},
    title: `Note ${i}`,
    sections: [],
    blocks: [],
    tags: [],
    aliases: [],
    links: targets.map((t, index) => ({
      type: 'wikilink' as const,
      range: Range.create(index, 0, index, 10),
      rawText: `[[note-${t}]]`,
      isEmbed: false,
      definition: `note-${t}`,
    })),
    footnotes: [],
  };
}

function buildWorkspace(size: number): FoamWorkspace {
  const workspace = createTestWorkspace();
  for (let i = 0; i < size; i++) {
    workspace.set(makeNote(i, size));
  }
  return workspace;
}

for (const size of REPO_BENCHMARK_SIZES) {
  const notes = Array.from({ length: size }, (_, i) => makeNote(i, size));

  describe(`Repository — ${size} notes`, () => {
    const workspace = createTestWorkspace();
    bench('workspace build', () => {
      for (const note of notes) {
        workspace.set(note);
      }
    });

    bench('graph build', () => {
      const graph = FoamGraph.fromWorkspace(workspace);
      graph.dispose();
    });

    const graph = FoamGraph.fromWorkspace(workspace);
    bench('graph update (1 note changed)', () => {
      graph.update();
    });
  });
}
