import { FoamGraph } from '../model/graph';
import { Logger } from '../utils/log';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { getOrphans, listOrphans, listPlaceholders } from './list';

Logger.setLevel('error');

describe('getOrphans', () => {
  it('returns the notes with no links in either direction', () => {
    const workspace = createTestWorkspace()
      .set(createTestNote({ uri: '/linked.md', links: [{ slug: 'target' }] }))
      .set(createTestNote({ uri: '/target.md' }))
      .set(createTestNote({ uri: '/orphan.md' }));
    const graph = FoamGraph.fromWorkspace(workspace);

    expect(getOrphans(workspace, graph).map(r => r.uri.path)).toEqual([
      '/orphan.md',
    ]);
  });

  it('skips attachments and images', () => {
    const workspace = createTestWorkspace()
      .set(createTestNote({ uri: '/orphan.md' }))
      .set(createTestNote({ uri: '/doc.pdf', type: 'attachment' }))
      .set(createTestNote({ uri: '/pic.png', type: 'image' }));
    const graph = FoamGraph.fromWorkspace(workspace);

    expect(getOrphans(workspace, graph).map(r => r.uri.path)).toEqual([
      '/orphan.md',
    ]);
  });

  it('counts a note linking only to an image as an orphan when ignoreOutgoingExcludedTypes is set', () => {
    const workspace = createTestWorkspace()
      .set(createTestNote({ uri: '/note.md', links: [{ slug: 'pic.png' }] }))
      .set(createTestNote({ uri: '/pic.png', type: 'image' }));
    const graph = FoamGraph.fromWorkspace(workspace);

    expect(getOrphans(workspace, graph).map(r => r.uri.path)).toEqual([]);
    expect(
      getOrphans(workspace, graph, { ignoreOutgoingExcludedTypes: true }).map(
        r => r.uri.path
      )
    ).toEqual(['/note.md']);
  });
});

describe('listOrphans', () => {
  it('identifies each orphan by its shortest unambiguous identifier', () => {
    const workspace = createTestWorkspace()
      .set(createTestNote({ uri: '/a/README.md', title: 'A' }))
      .set(createTestNote({ uri: '/b/README.md', title: 'B' }))
      .set(createTestNote({ uri: '/c/note.md', title: 'Note' }));
    const graph = FoamGraph.fromWorkspace(workspace);

    expect(
      listOrphans(workspace, graph)
        .map(({ id, uri, title }) => ({ id, path: uri.path, title }))
        .sort((a, b) => a.path.localeCompare(b.path))
    ).toEqual([
      { id: 'a/README', path: '/a/README.md', title: 'A' },
      { id: 'b/README', path: '/b/README.md', title: 'B' },
      { id: 'note', path: '/c/note.md', title: 'Note' },
    ]);
  });
});

describe('listPlaceholders', () => {
  it('identifies each referencing note by its shortest unambiguous identifier', () => {
    const workspace = createTestWorkspace()
      .set(
        createTestNote({
          uri: '/a/README.md',
          title: 'A',
          links: [{ slug: 'missing' }],
        })
      )
      .set(
        createTestNote({
          uri: '/b/README.md',
          title: 'B',
          links: [{ slug: 'missing' }, { slug: 'other' }],
        })
      )
      .set(
        createTestNote({
          uri: '/c/note.md',
          title: 'Note',
          links: [{ slug: 'other' }],
        })
      );
    const graph = FoamGraph.fromWorkspace(workspace);

    expect(
      listPlaceholders(workspace, graph)
        .map(({ placeholder_id, referenced_by }) => ({
          placeholder_id,
          referenced_by: referenced_by
            .map(({ id, uri, title }) => ({ id, path: uri.path, title }))
            .sort((a, b) => a.path.localeCompare(b.path)),
        }))
        .sort((a, b) => a.placeholder_id.localeCompare(b.placeholder_id))
    ).toEqual([
      {
        placeholder_id: 'missing',
        referenced_by: [
          { id: 'a/README', path: '/a/README.md', title: 'A' },
          { id: 'b/README', path: '/b/README.md', title: 'B' },
        ],
      },
      {
        placeholder_id: 'other',
        referenced_by: [
          { id: 'b/README', path: '/b/README.md', title: 'B' },
          { id: 'note', path: '/c/note.md', title: 'Note' },
        ],
      },
    ]);
  });
});
