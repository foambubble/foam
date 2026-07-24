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
 * Grouped by OPERATION with repo size as the bench name, so the scaling gate
 * (scripts/perf) checks each operation's complexity across sizes:
 *   - workspace build [linear] — set N notes into the workspace
 *   - graph build [linear]     — FoamGraph.fromWorkspace (resolve every link)
 *   - graph update full rebuild [linear] — a change triggering a full rebuild
 *   - graph update incremental [flat] — a single note change via the monitored
 *       graph's incremental handler; must stay ~constant regardless of repo
 *       size (that's the whole point of the incremental work — if it regressed
 *       to a full rebuild it would become [linear] and the gate would catch it).
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

/**
 * Per-size fixtures, built ONCE up front so transposing to operation-grouped
 * benches doesn't rebuild each size's workspace/graph per operation.
 */
interface Fixture {
  notes: Resource[];
  /** A pre-populated workspace, for graph build/rebuild benches. */
  workspace: FoamWorkspace;
  /** A graph over `workspace`, for the full-rebuild bench. */
  graph: FoamGraph;
  /** A workspace with a monitored (incremental) graph, for the update bench. */
  monitoredWs: FoamWorkspace;
}

const fixtures = new Map<number, Fixture>();
for (const size of REPO_BENCHMARK_SIZES) {
  const notes = Array.from({ length: size }, (_, i) => makeNote(i, size));
  const workspace = createTestWorkspace();
  for (const note of notes) {
    workspace.set(note);
  }
  const monitoredWs = buildWorkspace(size);
  FoamGraph.fromWorkspace(monitoredWs, true); // subscribe incremental handlers
  fixtures.set(size, {
    notes,
    workspace,
    graph: FoamGraph.fromWorkspace(workspace),
    monitoredWs,
  });
}

const eachSize = (fn: (size: number, f: Fixture) => void) => {
  for (const size of REPO_BENCHMARK_SIZES) {
    fn(size, fixtures.get(size)!);
  }
};

describe('workspace build [linear]', () => {
  eachSize((size, f) => {
    bench(`${size} notes`, () => {
      const workspace = createTestWorkspace();
      for (const note of f.notes) {
        workspace.set(note);
      }
    });
  });
});

describe('graph build [linear]', () => {
  eachSize((size, f) => {
    bench(`${size} notes`, () => {
      FoamGraph.fromWorkspace(f.workspace).dispose();
    });
  });
});

describe('graph update full rebuild [linear]', () => {
  eachSize((size, f) => {
    bench(`${size} notes`, () => {
      f.graph.update();
    });
  });
});

// Incremental path: a single note change flows through the monitored graph's
// onDidUpdate handler, touching only that note's connections. Must stay ~flat
// across sizes — that's the guard that it hasn't regressed to a full rebuild.
describe('graph update incremental [flat]', () => {
  eachSize((size, f) => {
    let flip = 0;
    bench(`${size} notes`, () => {
      const alt = makeNote(0, size);
      alt.links = alt.links.slice(0, 3 - (flip++ % 2)); // vary link count
      f.monitoredWs.set(alt);
    });
  });
});
