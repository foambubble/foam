import { FoamGraph } from '../model/graph';
import { Logger } from '../utils/log';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { renderDqlQuery } from './dql';

Logger.setLevel('error');

function makeWorkspaceAndGraph(notes: ReturnType<typeof createTestNote>[]) {
  const workspace = createTestWorkspace();
  notes.forEach(n => workspace.set(n));
  const graph = FoamGraph.fromWorkspace(workspace, false);
  return { workspace, graph };
}

describe('renderDqlQuery — warning escaping', () => {
  it('escapes user-controlled filter text in warnings to prevent HTML injection', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);

    // The filter targets a note identifier containing an HTML payload. The
    // resulting "not found" warning embeds this string; if it were rendered
    // unescaped the preview would inject the tag into the DOM.
    const html = renderDqlQuery(
      `filter:\n  links_to: '<img src=x onerror=alert(1)>'`,
      workspace,
      graph,
      false,
      p => p
    );

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('escapes regex source in path-filter warnings', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const html = renderDqlQuery(
      `filter:\n  path: '<script>(a+)+$'`,
      workspace,
      graph,
      false,
      p => p
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
