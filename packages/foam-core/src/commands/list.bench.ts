import { bench, describe } from 'vitest';
import { FoamGraph } from '../model/graph';
import { URI } from '../model/uri';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { getOrphans, listOrphans, listPlaceholders } from './list';

/**
 * Orphan and placeholder listing over a workspace whose notes all share one
 * basename, the worst case for identifier computation: every note's
 * identifier depends on every other note with the same basename.
 */

/** Workspace sizes we track, in notes sharing one basename. */
const SAME_BASENAME_SIZES = [250, 500, 1000, 2000];

const sameBasenameWorkspace = (
  size: number,
  links: (i: number) => Array<{ slug: string }>
) => {
  const workspace = createTestWorkspace([URI.file('/repo')]);
  for (let i = 0; i < size; i++) {
    workspace.set(
      createTestNote({
        uri: `/repo/site-packages/pkg-${i}/README.md`,
        links: links(i),
      })
    );
  }
  return { size, workspace, graph: FoamGraph.fromWorkspace(workspace) };
};

const orphanFixtures = SAME_BASENAME_SIZES.map(size =>
  sameBasenameWorkspace(size, () => [])
);

/** Each note links to a placeholder of its own. */
const placeholderFixtures = SAME_BASENAME_SIZES.map(size =>
  sameBasenameWorkspace(size, i => [{ slug: `missing-${i}` }])
);

describe('get orphans [linear]', () => {
  for (const { size, workspace, graph } of orphanFixtures) {
    bench(`${size} notes`, () => {
      getOrphans(workspace, graph, { ignoreOutgoingExcludedTypes: true });
    });
  }
});

describe('list orphans [linear]', () => {
  for (const { size, workspace, graph } of orphanFixtures) {
    bench(`${size} notes`, () => {
      listOrphans(workspace, graph, { ignoreOutgoingExcludedTypes: true });
    });
  }
});

describe('list placeholders [linear]', () => {
  for (const { size, workspace, graph } of placeholderFixtures) {
    bench(`${size} notes`, () => {
      listPlaceholders(workspace, graph);
    });
  }
});
