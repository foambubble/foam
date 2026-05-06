import { searchWorkspace } from './search';
import {
  createTestNote,
  createTestWorkspace,
} from '../../test/test-utils';

describe('searchWorkspace matchMode', () => {
  it('uses substring matching by default', () => {
    const workspace = createTestWorkspace()
      .set(createTestNote({ uri: '/alternative.md', title: 'Alternative' }))
      .set(createTestNote({ uri: '/contemporary.md', title: 'Contemporary' }));

    // 'alt' is a substring of 'Alternative'
    const r1 = searchWorkspace(workspace, { query: 'alt' });
    expect(r1.map(m => m.title)).toEqual(['Alternative']);

    // 'aly' is not a substring of either title
    const r2 = searchWorkspace(workspace, { query: 'aly' });
    expect(r2).toEqual([]);
  });

  it('uses subsequence matching when matchMode is "subsequence"', () => {
    const workspace = createTestWorkspace()
      .set(createTestNote({ uri: '/alternative.md', title: 'Alternative' }))
      .set(createTestNote({ uri: '/contemporary.md', title: 'Contemporary' }));

    // 'alt' is a subsequence of 'Alternative' (a-l-t)
    const r1 = searchWorkspace(workspace, {
      query: 'alt',
      matchMode: 'subsequence',
    });
    expect(r1.map(m => m.title)).toEqual(['Alternative']);

    // 'cmpy' is a subsequence of 'Contemporary' (c-m-p-y) but not a substring
    const r2 = searchWorkspace(workspace, {
      query: 'cmpy',
      matchMode: 'subsequence',
    });
    expect(r2.map(m => m.title)).toEqual(['Contemporary']);

    // Substring mode misses the same query
    const r3 = searchWorkspace(workspace, {
      query: 'cmpy',
      matchMode: 'substring',
    });
    expect(r3).toEqual([]);
  });

  it('matches against aliases in subsequence mode', () => {
    const workspace = createTestWorkspace().set(
      createTestNote({
        uri: '/note.md',
        title: 'Project Plan',
        aliases: ['Roadmap'],
      })
    );
    const r = searchWorkspace(workspace, {
      query: 'rmp',
      matchMode: 'subsequence',
    });
    expect(r.map(m => m.title)).toEqual(['Project Plan']);
  });

  it('subsequence requires characters in order', () => {
    const workspace = createTestWorkspace().set(
      createTestNote({ uri: '/notes.md', title: 'Notes' })
    );
    // 'sotn' has the right characters but in wrong order
    const r = searchWorkspace(workspace, {
      query: 'sotn',
      matchMode: 'subsequence',
    });
    expect(r).toEqual([]);
  });
});
