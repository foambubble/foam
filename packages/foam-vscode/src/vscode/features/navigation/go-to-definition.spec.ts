import * as vscode from 'vscode';
import waitForExpect from 'wait-for-expect';
import { URI } from '@foam/core';
import {
  closeEditors,
  createFile,
  deleteFile,
  getActiveTabViewType,
  MARKDOWN_EDITOR_VIEW_TYPE,
  showInEditor,
  waitForNoteInFoamWorkspace,
  withMarkdownEditorAssociation,
} from '../../../test/test-utils-vscode';
import { getActiveTabUri } from '../../services/editor';

// Drives VS Code's own Go to Definition, which is what ctrl/cmd+click on a
// wikilink runs, so it needs the extension host and is not @unit-ready.
describe('Go to Definition on a wikilink', () => {
  const openSourceLinkingTo = async (
    targetContent: string,
    name: string,
    linkText: string
  ) => {
    const target = await createFile(targetContent, [`${name}.md`]);
    const source = await createFile(`see [[${linkText}]] here`, [
      `${name}-source.md`,
    ]);
    await waitForNoteInFoamWorkspace(target.uri);
    await waitForNoteInFoamWorkspace(source.uri);
    const { editor } = await showInEditor(source.uri);
    // inside the wikilink, just past `see [[`
    editor.selection = new vscode.Selection(0, 7, 0, 7);
    return { target: target.uri, source: source.uri };
  };

  const goToDefinition = () =>
    vscode.commands.executeCommand('editor.action.revealDefinition');

  const cleanUp = async (...uris: URI[]) => {
    await closeEditors();
    for (const uri of uris) {
      await deleteFile(uri);
    }
  };

  it('opens the target in the editor associated with Markdown (#1742)', async () => {
    await closeEditors();
    const { target, source } = await openSourceLinkingTo(
      '# Target',
      'definition-associated',
      'definition-associated'
    );

    await withMarkdownEditorAssociation(async () => {
      await goToDefinition();

      await waitForExpect(() => {
        expect(getActiveTabViewType()).toEqual(MARKDOWN_EDITOR_VIEW_TYPE);
        expect(getActiveTabUri()?.path).toEqual(target.path);
      });
    });

    await cleanUp(target, source);
  });

  it('opens the target in the text editor when nothing is associated with Markdown (#1742)', async () => {
    await closeEditors();
    const { target, source } = await openSourceLinkingTo(
      '# Target',
      'definition-plain',
      'definition-plain'
    );

    await goToDefinition();

    await waitForExpect(() => {
      expect(getActiveTabViewType()).toBeUndefined();
      expect(vscode.window.activeTextEditor?.document.uri.path).toEqual(
        target.path
      );
    });

    await cleanUp(target, source);
  });

  it('lands on the section of a [[note#Section]] wikilink (#1742)', async () => {
    await closeEditors();
    const { target, source } = await openSourceLinkingTo(
      '# Target\n\n## Details\n\nsome text',
      'definition-section',
      'definition-section#Details'
    );

    await goToDefinition();

    await waitForExpect(() => {
      const editor = vscode.window.activeTextEditor;
      expect(editor?.document.uri.path).toEqual(target.path);
      expect(editor.selection.isEmpty).toBe(true);
      expect(editor.selection.active).toEqual(new vscode.Position(2, 0));
    });

    await cleanUp(target, source);
  });
});
