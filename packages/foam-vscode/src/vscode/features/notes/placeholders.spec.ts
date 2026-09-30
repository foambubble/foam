/* @unit-ready */
import * as vscode from 'vscode';
import { FoamGraph } from '@foam/core';
import {
  createNoteFromMarkdown,
  createTestWorkspace,
} from '../../../test/test-utils';
import { withModifiedFoamConfiguration } from '../../../test/test-utils-vscode';
import { MapBasedMemento, fromVsCodeUri } from '../../utils/vsc-utils';
import { UriTreeItem } from '../../utils/tree-views/tree-view-utils';
import { PlaceholderTreeView, createPlaceholderMatcher } from './placeholders';

/**
 * Builds the panel over a note in `docs/` that links to three missing notes:
 * one by wikilink, one next to it, and one outside `docs/`.
 * Returns the paths of the placeholders the panel lists.
 */
const listPlaceholdersInPanel = async () => {
  const root = fromVsCodeUri(vscode.workspace.workspaceFolders[0].uri);
  const workspace = createTestWorkspace([root]).set(
    createNoteFromMarkdown(
      root.joinPath('docs', 'note.md').path,
      [
        '[[missing-note]]',
        '[missing](missing.md)',
        '[elsewhere](../elsewhere/missing.md)',
      ].join('\n\n')
    )
  );
  const graph = FoamGraph.fromWorkspace(workspace);
  const panel = new PlaceholderTreeView(
    new MapBasedMemento(),
    workspace,
    graph,
    await createPlaceholderMatcher()
  );
  try {
    await panel.groupBy.update('off');
    panel.refresh();
    const items = (await panel.getChildren()) as UriTreeItem[];
    return {
      root,
      paths: items.map(item => item.uri.path).sort(),
      count: panel.nValues,
    };
  } finally {
    panel.dispose();
    graph.dispose();
    workspace.dispose();
  }
};

describe('Placeholders panel', () => {
  it('lists every placeholder when foam.files.include is restricted to a subfolder (#1702)', async () => {
    await withModifiedFoamConfiguration(
      'files.include',
      ['docs/**/*.md'],
      async () => {
        const { root, paths, count } = await listPlaceholdersInPanel();

        expect(paths).toEqual(
          [
            'missing-note',
            root.joinPath('docs', 'missing.md').path,
            root.joinPath('elsewhere', 'missing.md').path,
          ].sort()
        );
        expect(count).toBe(3);
      }
    );
  });

  it('hides placeholders matching foam.placeholders.exclude', async () => {
    await withModifiedFoamConfiguration(
      'placeholders.exclude',
      ['elsewhere/**'],
      async () => {
        const { root, paths } = await listPlaceholdersInPanel();

        expect(paths).toEqual(
          ['missing-note', root.joinPath('docs', 'missing.md').path].sort()
        );
      }
    );
  });
});
