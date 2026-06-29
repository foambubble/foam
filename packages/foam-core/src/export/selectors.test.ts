import { describe, expect, it } from 'vitest';
import { FoamGraph } from '../model/graph';
import { URI } from '../model/uri';
import {
  createNoteFromMarkdown,
  createTestNote,
  createTestWorkspace,
} from '../../test/test-utils';
import { selectAll, selectByUris, selectWhere } from './selectors';

describe('selectAll', () => {
  it('returns every note in the workspace', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root])
      .set(createNoteFromMarkdown('a.md', '# A', root))
      .set(createNoteFromMarkdown('b.md', '# B', root));
    const graph = FoamGraph.fromWorkspace(workspace);
    const result = selectAll()(workspace, graph);
    expect(result.map(r => r.uri.getBasename()).sort()).toEqual([
      'a.md',
      'b.md',
    ]);
  });

  it('does not include attachments or images', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root])
      .set(createNoteFromMarkdown('note.md', '# A', root))
      .set(
        createTestNote({
          uri: '/logo.png',
          title: 'logo',
          type: 'image',
        })
      );
    const graph = FoamGraph.fromWorkspace(workspace);
    const result = selectAll()(workspace, graph);
    expect(result.map(r => r.uri.getBasename())).toEqual(['note.md']);
  });
});

describe('selectWhere', () => {
  it('keeps notes matching the predicate, in workspace order', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root])
      .set(
        createNoteFromMarkdown(
          'a.md',
          '---\ndraft: true\n---\n# A',
          root
        )
      )
      .set(createNoteFromMarkdown('b.md', '# B', root))
      .set(
        createNoteFromMarkdown(
          'c.md',
          '---\ndraft: true\n---\n# C',
          root
        )
      );
    const graph = FoamGraph.fromWorkspace(workspace);
    const result = selectWhere(r => r.properties.draft !== true)(
      workspace,
      graph
    );
    expect(result.map(r => r.uri.getBasename())).toEqual(['b.md']);
  });

  it('drops attachments before applying the predicate', () => {
    // Predicates run only against notes — attachments never satisfy the
    // selector even if the predicate would have said yes.
    const root = URI.file('/');
    const workspace = createTestWorkspace([root])
      .set(createNoteFromMarkdown('note.md', '# A', root))
      .set(
        createTestNote({
          uri: '/logo.png',
          title: 'logo',
          type: 'image',
        })
      );
    const graph = FoamGraph.fromWorkspace(workspace);
    const result = selectWhere(() => true)(workspace, graph);
    expect(result.map(r => r.uri.getBasename())).toEqual(['note.md']);
  });
});

describe('selectByUris', () => {
  it('returns notes in the order their URIs are given', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root])
      .set(createNoteFromMarkdown('a.md', '# A', root))
      .set(createNoteFromMarkdown('b.md', '# B', root))
      .set(createNoteFromMarkdown('c.md', '# C', root));
    const graph = FoamGraph.fromWorkspace(workspace);
    const result = selectByUris([
      root.joinPath('c.md'),
      root.joinPath('a.md'),
    ])(workspace, graph);
    expect(result.map(r => r.uri.getBasename())).toEqual(['c.md', 'a.md']);
  });

  it('deduplicates repeated URIs, keeping first occurrence', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root])
      .set(createNoteFromMarkdown('a.md', '# A', root))
      .set(createNoteFromMarkdown('b.md', '# B', root));
    const graph = FoamGraph.fromWorkspace(workspace);
    const result = selectByUris([
      root.joinPath('a.md'),
      root.joinPath('b.md'),
      root.joinPath('a.md'),
    ])(workspace, graph);
    expect(result.map(r => r.uri.getBasename())).toEqual(['a.md', 'b.md']);
  });

  it('silently drops URIs that do not resolve to a workspace note', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root]).set(
      createNoteFromMarkdown('a.md', '# A', root)
    );
    const graph = FoamGraph.fromWorkspace(workspace);
    const result = selectByUris([
      root.joinPath('a.md'),
      root.joinPath('does-not-exist.md'),
    ])(workspace, graph);
    expect(result.map(r => r.uri.getBasename())).toEqual(['a.md']);
  });

  it('drops non-note resources (assets) even if their URIs are provided', () => {
    const root = URI.file('/');
    const workspace = createTestWorkspace([root])
      .set(createNoteFromMarkdown('a.md', '# A', root))
      .set(
        createTestNote({
          uri: '/logo.png',
          title: 'logo',
          type: 'image',
        })
      );
    const graph = FoamGraph.fromWorkspace(workspace);
    const result = selectByUris([
      root.joinPath('logo.png'),
      root.joinPath('a.md'),
    ])(workspace, graph);
    expect(result.map(r => r.uri.getBasename())).toEqual(['a.md']);
  });
});
