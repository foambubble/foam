import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { FoamGraph } from '../model/graph';
import type { Resource } from '../model/note';
import { URI } from '../model/uri';
import {
  buildGraphData,
  type BuiltGraphData,
  type GraphBuilderOptions,
} from './graph-data-builder';

const root = URI.file('/ws');

const buildWithFolders = (
  resources: Resource[],
  roots: URI[] = [root],
  resourceToId: GraphBuilderOptions['resourceToId'] = uri => uri.path
) => {
  const workspace = createTestWorkspace(roots);
  resources.forEach(resource => workspace.set(resource));
  const graph = FoamGraph.fromWorkspace(workspace);
  return buildGraphData(workspace.list(), graph.getAllConnections(), {
    resourceToId,
    includePlaceholders: true,
    folderRoots: roots,
  });
};

const folders = (data: BuiltGraphData) =>
  Object.values(data.nodeInfo).filter(node => node.type === 'folder');

const foldersTitled = (data: BuiltGraphData, title: string) =>
  folders(data).filter(node => node.title === title);

const linksInto = (data: BuiltGraphData, id: string) =>
  data.links.filter(link => link.target === id);

const linksOutOf = (data: BuiltGraphData, id: string) =>
  data.links.filter(link => link.source === id);

describe('buildGraphData with folder roots', () => {
  // AC-1
  it('adds a node per folder, linking each folder to its subfolders and files', () => {
    const note = createTestNote({ uri: '/ws/projects/alpha/kickoff.md' });

    const data = buildWithFolders([note]);

    const [projects] = foldersTitled(data, 'projects');
    const [alpha] = foldersTitled(data, 'alpha');
    expect(folders(data)).toHaveLength(2);
    expect(data.links).toEqual(
      expect.arrayContaining([
        { source: projects.id, target: alpha.id },
        { source: alpha.id, target: note.uri.path },
      ])
    );
    expect(data.links).toHaveLength(2);
  });

  // AC-2
  it('gives no node to the workspace folder or to a folder with no file in the graph', () => {
    const top = createTestNote({ uri: '/ws/top.md' });
    const excluded = createTestNote({ uri: '/ws/private/secret.md' });

    const data = buildWithFolders([top, excluded], [root], uri =>
      uri.path === excluded.uri.path ? undefined : uri.path
    );

    expect(folders(data)).toEqual([]);
    expect(linksInto(data, top.uri.path)).toEqual([]);
  });

  // AC-3
  it('links attachments and images to their folder, and placeholders to none', () => {
    const attachment = createTestNote({
      uri: '/ws/assets/manual.pdf',
      type: 'attachment',
    });
    const image = createTestNote({ uri: '/ws/assets/diagram.png', type: 'image' });
    const note = createTestNote({
      uri: '/ws/index.md',
      links: [{ slug: 'missing-note' }],
    });

    const data = buildWithFolders([attachment, image, note]);

    const [assets] = foldersTitled(data, 'assets');
    expect(linksOutOf(data, assets.id)).toEqual(
      expect.arrayContaining([
        { source: assets.id, target: attachment.uri.path },
        { source: assets.id, target: image.uri.path },
      ])
    );
    const placeholder = Object.values(data.nodeInfo).find(
      node => node.type === 'placeholder'
    )!;
    expect(linksInto(data, placeholder.id)).toEqual([
      { source: note.uri.path, target: placeholder.id },
    ]);
  });

  // AC-4
  it("keeps each root's folders apart in a multi-root workspace", () => {
    const rootA = URI.file('/a');
    const rootB = URI.file('/b');
    const inA = createTestNote({ uri: '/a/notes/one.md' });
    const inB = createTestNote({ uri: '/b/notes/two.md' });

    const data = buildWithFolders([inA, inB], [rootA, rootB]);

    const notes = foldersTitled(data, 'notes');
    expect(notes).toHaveLength(2);
    expect(
      notes.map(folder => linksOutOf(data, folder.id).map(link => link.target))
    ).toEqual(
      expect.arrayContaining([[inA.uri.path], [inB.uri.path]])
    );
  });

  // AC-5: the view keys a tag node by its label, one per level of nesting
  it('gives a folder an id no same-named tag or resource has', () => {
    const note = createTestNote({
      uri: '/ws/projects/alpha/kickoff.md',
      tags: ['projects/alpha'],
    });

    const data = buildWithFolders([note]);

    const ids = folders(data).map(folder => folder.id);
    expect(ids).toHaveLength(2);
    for (const taken of ['projects', 'projects/alpha', note.uri.path]) {
      expect(ids).not.toContain(taken);
    }
  });

  it('adds no folders without folder roots', () => {
    const note = createTestNote({ uri: '/ws/projects/alpha/kickoff.md' });
    const workspace = createTestWorkspace([root]).set(note);

    const data = buildGraphData(workspace.list(), [], {
      resourceToId: uri => uri.path,
    });

    expect(Object.keys(data.nodeInfo)).toEqual([note.uri.path]);
    expect(data.links).toEqual([]);
  });
});
