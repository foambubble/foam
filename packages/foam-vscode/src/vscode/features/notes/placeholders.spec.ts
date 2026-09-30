/* @unit-ready */
import * as vscode from 'vscode';
import { FoamGraph, listPlaceholders } from '@foam/core';
import {
  createNoteFromMarkdown,
  createTestWorkspace,
} from '../../../test/test-utils';
import { withModifiedFoamConfiguration } from '../../../test/test-utils-vscode';
import { fromVsCodeUri } from '../../utils/vsc-utils';
import { createPlaceholderMatcher } from './placeholders';

/**
 * Runs the panel's matcher over the placeholders of a note in `docs/` that
 * links to three missing notes: one by wikilink, one next to it, and one
 * outside `docs/`. Returns the paths of the placeholders it hides.
 */
const hiddenPlaceholders = async () => {
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
  try {
    const placeholders = listPlaceholders(workspace, graph).map(p => p.uri);
    expect(placeholders).toHaveLength(3);
    const matcher = await createPlaceholderMatcher();
    return {
      root,
      hidden: placeholders
        .filter(uri => !matcher.isMatch(uri))
        .map(uri => uri.path),
    };
  } finally {
    graph.dispose();
    workspace.dispose();
  }
};

describe('Placeholders panel filter', () => {
  it('shows every placeholder when foam.files.include is restricted to a subfolder (#1702)', async () => {
    await withModifiedFoamConfiguration(
      'files.include',
      ['docs/**/*.md'],
      async () => {
        const { hidden } = await hiddenPlaceholders();

        expect(hidden).toEqual([]);
      }
    );
  });

  it('hides placeholders matching foam.placeholders.exclude', async () => {
    await withModifiedFoamConfiguration(
      'placeholders.exclude',
      ['elsewhere/**'],
      async () => {
        const { root, hidden } = await hiddenPlaceholders();

        expect(hidden).toEqual([root.joinPath('elsewhere', 'missing.md').path]);
      }
    );
  });
});
