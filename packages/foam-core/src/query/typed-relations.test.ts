import { FoamGraph } from '../model/graph';
import { URI } from '../model/uri';
import { createMarkdownParser } from '../services/markdown-parser';
import { createTestWorkspace } from '../../test/test-utils';
import { parseFilter } from '.';

it('queries and updates directed frontmatter relations alongside ordinary links (#1626)', () => {
  const root = URI.file('/vault');
  const workspace = createTestWorkspace([root]);
  const parser = createMarkdownParser();
  const old = parser.parse(root.joinPath('adr/old.md'), '# Old');
  const nextUri = root.joinPath('adr/new.md');
  const next = parser.parse(
    nextUri,
    '---\nrelations:\n  supersedes: [adr/old.md, adr/old.md, ../escape.md]\n---\n[[old]]'
  );
  workspace.set(next);
  const graph = FoamGraph.fromWorkspace(workspace, true);
  try {
    expect(
      graph.getRelationsFrom(next.uri).map(edge => edge.target.path)
    ).toEqual([old.uri.path]);
    const query = () =>
      parseFilter(
        { relations_to: { type: 'supersedes', note: old.uri } },
        workspace,
        graph,
        false
      ).predicate(next);
    expect(query()).toBe(false);
    workspace.set(old);
    expect(query()).toBe(true);
    expect(
      parseFilter(
        { relations_from: { type: 'supersedes', note: next.uri } },
        workspace,
        graph,
        false
      ).predicate(old)
    ).toBe(true);
    expect(graph.getLinks(next.uri)).toHaveLength(1);
    workspace.set(
      parser.parse(nextUri, '---\nrelations: invalid\n---\n[[old]]')
    );
    expect(query()).toBe(false);
    expect(graph.getBacklinks(old.uri)).toHaveLength(1);
    workspace.set(next);
    workspace.delete(old.uri);
    expect(query()).toBe(false);
  } finally {
    graph.dispose();
  }
});
