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
import { toVsCodeUri } from '../../utils/vsc-utils';

// Drives VS Code's own Go to Definition, which is what ctrl/cmd+click on a
// wikilink runs, so it needs the extension host and is not @unit-ready.
describe('Go to Definition on a wikilink', () => {
  // inside the wikilink, just past `see [[`
  const insideLink = new vscode.Position(0, 7);

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
    await showInEditor(source.uri);
    return { target: target.uri, source: source.uri };
  };

  // What ctrl/cmd+click runs in the clicked editor: the definition providers
  // at that position, then VS Code's navigation to what they return.
  // `editor.action.revealDefinition` runs in whichever code editor has focus
  // instead, such as the Chat input, and does nothing when that is not the
  // source; `editor.action.goToLocations` runs in the source's own editor.
  const goToDefinition = async (source: URI) => {
    const uri = toVsCodeUri(source);
    const definitions = await vscode.commands.executeCommand<
      vscode.LocationLink[]
    >('vscode.executeDefinitionProvider', uri, insideLink);
    // with more than one, VS Code shows a picker instead of navigating
    expect(definitions).toHaveLength(1);
    const [{ targetUri, targetRange, targetSelectionRange }] = definitions;
    await vscode.commands.executeCommand(
      'editor.action.goToLocations',
      uri,
      insideLink,
      // VS Code navigates to a link's selection range when it has one
      [new vscode.Location(targetUri, targetSelectionRange ?? targetRange)],
      'goto'
    );
  };

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

    // Only the target: `goToDefinition` reopens the source by its URI, which
    // would otherwise open it in the Markdown Editor, with no definitions.
    await withMarkdownEditorAssociation(async () => {
      await goToDefinition(source);

      await waitForExpect(() => {
        expect(getActiveTabViewType()).toEqual(MARKDOWN_EDITOR_VIEW_TYPE);
        expect(getActiveTabUri()?.path).toEqual(target.path);
      });
    }, 'definition-associated.md');

    await cleanUp(target, source);
  });

  it('opens the target in the text editor when nothing is associated with Markdown (#1742)', async () => {
    await closeEditors();
    const { target, source } = await openSourceLinkingTo(
      '# Target',
      'definition-plain',
      'definition-plain'
    );

    await goToDefinition(source);

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

    await goToDefinition(source);

    await waitForExpect(() => {
      const editor = vscode.window.activeTextEditor;
      expect(editor?.document.uri.path).toEqual(target.path);
      expect(editor.selection.isEmpty).toBe(true);
      expect(editor.selection.active).toEqual(new vscode.Position(2, 0));
    });

    await cleanUp(target, source);
  });
});
