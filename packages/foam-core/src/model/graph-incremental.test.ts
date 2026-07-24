import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { FoamGraph } from './graph';
import { FoamWorkspace } from './workspace';

/** A comparable, order-independent snapshot of a graph's structure. */
interface GraphSnapshot {
  links: string[];
  backlinks: string[];
  placeholders: string[];
}

/** Serialises one connection so two graphs can be compared regardless of order. */
function connectionKey(c: {
  source: { path: string };
  target: { path: string };
  link: { rawText: string; range: unknown };
}): string {
  return `${c.source.path} -> ${c.target.path} | ${
    c.link.rawText
  } @ ${JSON.stringify(c.link.range)}`;
}

function snapshot(graph: FoamGraph): GraphSnapshot {
  const links = graph.getAllConnections().map(connectionKey).sort();
  const backlinks = Array.from(graph.backlinks.values())
    .flat()
    .map(connectionKey)
    .sort();
  const placeholders = Array.from(graph.placeholders.keys()).sort();
  return { links, backlinks, placeholders };
}

/** Asserts an incrementally-maintained graph matches a from-scratch rebuild. */
function expectEquivalentToRebuild(
  incremental: FoamGraph,
  workspace: FoamWorkspace
) {
  const scratch = FoamGraph.fromWorkspace(workspace);
  try {
    expect(snapshot(incremental)).toEqual(snapshot(scratch));
  } finally {
    scratch.dispose();
  }
}

describe('Incremental graph update equivalence', () => {
  it('matches a rebuild after updating a note to add and remove links', () => {
    const workspace = createTestWorkspace();
    workspace
      .set(createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] }))
      .set(createTestNote({ uri: '/b.md' }))
      .set(createTestNote({ uri: '/c.md' }));

    const graph = FoamGraph.fromWorkspace(workspace, true);

    // Change A: drop link to B, add links to C and a placeholder.
    workspace.set(
      createTestNote({
        uri: '/a.md',
        links: [{ slug: 'c' }, { slug: 'ghost' }],
      })
    );

    expectEquivalentToRebuild(graph, workspace);
    graph.dispose();
  });

  it('matches a rebuild after adding a note that fills an existing placeholder', () => {
    const workspace = createTestWorkspace();
    // A links to a not-yet-existing note -> placeholder.
    workspace.set(
      createTestNote({ uri: '/a.md', links: [{ slug: 'future' }] })
    );

    const graph = FoamGraph.fromWorkspace(workspace, true);
    // Sanity: 'future' is a placeholder before the note exists.
    expect(Array.from(graph.placeholders.keys())).toContain('future');

    // Add the note that fills the placeholder — A's link must now resolve to it.
    workspace.set(createTestNote({ uri: '/future.md' }));

    expectEquivalentToRebuild(graph, workspace);
    graph.dispose();
  });

  it('matches a rebuild after deleting a note that others link to', () => {
    const workspace = createTestWorkspace();
    workspace
      .set(createTestNote({ uri: '/a.md', links: [{ slug: 'b' }] }))
      .set(createTestNote({ uri: '/b.md', links: [{ slug: 'a' }] }));

    const graph = FoamGraph.fromWorkspace(workspace, true);

    // Delete B — A's link to B must demote to a placeholder.
    workspace.delete(createTestNote({ uri: '/b.md' }).uri);

    expectEquivalentToRebuild(graph, workspace);
    graph.dispose();
  });

  it('matches a rebuild after a mixed sequence of mutations', () => {
    const workspace = createTestWorkspace();
    workspace
      .set(
        createTestNote({ uri: '/a.md', links: [{ slug: 'b' }, { slug: 'x' }] })
      )
      .set(createTestNote({ uri: '/b.md', links: [{ slug: 'c' }] }))
      .set(createTestNote({ uri: '/c.md', links: [{ slug: 'a' }] }));

    const graph = FoamGraph.fromWorkspace(workspace, true);

    // A sequence touching every path: update, add-fills-placeholder, delete.
    workspace.set(
      createTestNote({ uri: '/b.md', links: [{ slug: 'a' }, { slug: 'x' }] })
    );
    expectEquivalentToRebuild(graph, workspace);

    workspace.set(createTestNote({ uri: '/x.md', links: [{ slug: 'b' }] }));
    expectEquivalentToRebuild(graph, workspace);

    workspace.delete(createTestNote({ uri: '/a.md' }).uri);
    expectEquivalentToRebuild(graph, workspace);

    graph.dispose();
  });

  it('matches a rebuild when two notes link to the same placeholder and one is removed', () => {
    const workspace = createTestWorkspace();
    // Both A and B link to the same placeholder 'shared'.
    workspace
      .set(createTestNote({ uri: '/a.md', links: [{ slug: 'shared' }] }))
      .set(createTestNote({ uri: '/b.md', links: [{ slug: 'shared' }] }));

    const graph = FoamGraph.fromWorkspace(workspace, true);
    expect(Array.from(graph.placeholders.keys())).toContain('shared');

    // Remove A's link to 'shared'. The placeholder must STAY (B still links it).
    workspace.set(createTestNote({ uri: '/a.md', links: [] }));
    expectEquivalentToRebuild(graph, workspace);
    expect(Array.from(graph.placeholders.keys())).toContain('shared');

    // Remove B's link too. Now the placeholder must be gone.
    workspace.set(createTestNote({ uri: '/b.md', links: [] }));
    expectEquivalentToRebuild(graph, workspace);
    expect(Array.from(graph.placeholders.keys())).not.toContain('shared');

    graph.dispose();
  });

  it('matches a rebuild after a rename (delete old + add new), preserving outgoing links', () => {
    // Foam has no rename event: a rename arrives as delete(old) + add(new).
    // The renamed note keeps its own outgoing links (they travel with it), but
    // notes that linked to the OLD name by slug do not auto-follow — they demote
    // to a placeholder for the old name until the link text is updated.
    const workspace = createTestWorkspace();
    workspace
      .set(createTestNote({ uri: '/old.md', links: [{ slug: 'target' }] }))
      .set(createTestNote({ uri: '/target.md' }))
      .set(createTestNote({ uri: '/referrer.md', links: [{ slug: 'old' }] }));

    const graph = FoamGraph.fromWorkspace(workspace, true);

    // Rename old.md -> new.md, carrying its outgoing [[target]] link along.
    workspace.delete(createTestNote({ uri: '/old.md' }).uri);
    expectEquivalentToRebuild(graph, workspace);
    workspace.set(
      createTestNote({ uri: '/new.md', links: [{ slug: 'target' }] })
    );
    expectEquivalentToRebuild(graph, workspace);

    // new.md's own link to target survives the rename.
    const newNote = createTestNote({ uri: '/new.md' });
    expect(graph.getLinks(newNote.uri).map(c => c.target.path)).toEqual([
      '/target.md',
    ]);
    // referrer's [[old]] did NOT follow the rename; it points at a placeholder.
    expect(Array.from(graph.placeholders.keys())).toContain('old');

    graph.dispose();
  });

  it('matches a rebuild when a rename fills a placeholder that referrers were using', () => {
    // If a note is renamed TO a name that other notes already link to as a
    // placeholder, those referrers must now resolve to the renamed note.
    const workspace = createTestWorkspace();
    workspace
      .set(createTestNote({ uri: '/old.md' }))
      .set(createTestNote({ uri: '/referrer.md', links: [{ slug: 'new' }] }));

    const graph = FoamGraph.fromWorkspace(workspace, true);
    // referrer links to placeholder 'new' (no such note yet).
    expect(Array.from(graph.placeholders.keys())).toContain('new');

    // Rename old.md -> new.md.
    workspace.delete(createTestNote({ uri: '/old.md' }).uri);
    expectEquivalentToRebuild(graph, workspace);
    workspace.set(createTestNote({ uri: '/new.md' }));
    expectEquivalentToRebuild(graph, workspace);

    // referrer's [[new]] now resolves to the real note; placeholder is gone.
    expect(Array.from(graph.placeholders.keys())).not.toContain('new');
    const referrer = createTestNote({ uri: '/referrer.md' });
    expect(graph.getLinks(referrer.uri).map(c => c.target.path)).toEqual([
      '/new.md',
    ]);

    graph.dispose();
  });
});
