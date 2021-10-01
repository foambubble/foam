import { FoamGraph } from '../core/model/graph';
import { createTestNote, createTestWorkspace } from '../test/test-utils';
import { isOrphan } from './orphans';

const orphanA = createTestNote({
  uri: '/path/orphan-a.md',
  title: 'Orphan A',
});

const nonOrphan1 = createTestNote({
  uri: '/path/non-orphan-1.md',
});

const nonOrphan2 = createTestNote({
  uri: '/path/non-orphan-2.md',
  links: [{ slug: 'non-orphan-1' }],
});

const workspace = createTestWorkspace()
  .set(orphanA)
  .set(nonOrphan1)
  .set(nonOrphan2);
const graph = FoamGraph.fromWorkspace(workspace);

describe('isOrphan', () => {
  it('should return true when a note with no connections is provided', () => {
    expect(isOrphan(orphanA.uri, graph)).toBeTruthy();
  });
  it('should return false when a note with connections is provided', () => {
    expect(isOrphan(nonOrphan1.uri, graph)).toBeFalsy();
  });
});
