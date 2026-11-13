import * as vscode from 'vscode';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  deleteFile,
  getFoamFromVSCode,
  readFile,
  showInEditor,
  waitForNoteInFoamWorkspace,
} from '../../../test/test-utils-vscode';
import { waitForExpect } from '../../../test/test-utils';
import { toVsCodeUri } from '../../utils/vsc-utils';

/**
 * Not `@unit-ready`: the point is which rename provider VS Code picks, so
 * these have to run against the real editor. Everywhere else a provider is
 * called directly, which answers what it does rather than whether it is asked.
 *
 * `vscode.executeDocumentRenameProvider` runs the same selection F2 does, and
 * returns the winning provider's edit.
 */
describe('Rename dispatch', () => {
  beforeAll(async () => {
    await closeEditors();
    await cleanWorkspace();
  });
  afterAll(closeEditors);

  const rename = (uri: vscode.Uri, position: vscode.Position, name: string) =>
    vscode.commands.executeCommand<vscode.WorkspaceEdit>(
      'vscode.executeDocumentRenameProvider',
      uri,
      position,
      name
    );

  it('should give a section rename started on a markdown link to Foam, wikilinks and all', async () => {
    const target = await createFile('# Note\n\n## My Section\n\nBody.\n', [
      'dispatch',
      'target.md',
    ]);
    const links = await createFile(
      `Wiki [[target#My Section]]\n\nMd [text](./target.md#my-section)\n`,
      ['dispatch', 'links.md']
    );
    await Promise.all(
      [target, links].map(n => waitForNoteInFoamWorkspace(n.uri))
    );
    (await getFoamFromVSCode()).graph.update();
    const { doc } = await showInEditor(links.uri);

    const edit = await rename(
      doc.uri,
      new vscode.Position(2, 'Md [text](./target.md#my'.length),
      'New Section'
    );

    // VS Code's own markdown provider knows nothing of wikilinks, so a
    // rewritten wikilink is proof that Foam answered
    const linkEdits = edit.get(toVsCodeUri(links.uri)).map(e => e.newText);
    expect(linkEdits).toContain('[[target#New Section]]');
    expect(linkEdits).toContain('[text](./target.md#new-section)');
    expect(edit.get(toVsCodeUri(target.uri))[0].newText).toEqual('New Section');

    await deleteFile(target.uri);
    await deleteFile(links.uri);
  });

  it('should give a note rename started on a wikilink to Foam, moving the file', async () => {
    const target = await createFile('# The note\n', [
      'dispatch',
      'to-rename.md',
    ]);
    const links = await createFile(`Wiki [[to-rename]] here.\n`, [
      'dispatch',
      'to-rename-links.md',
    ]);
    await Promise.all(
      [target, links].map(n => waitForNoteInFoamWorkspace(n.uri))
    );
    (await getFoamFromVSCode()).graph.update();
    const { doc } = await showInEditor(links.uri);

    const edit = await rename(
      doc.uri,
      new vscode.Position(0, 'Wiki [[to-re'.length),
      'was-renamed'
    );
    await vscode.workspace.applyEdit(edit);

    // The built-in provider would rewrite the link text and move nothing
    const renamed = target.uri.withName('was-renamed');
    await waitForExpect(async () => {
      expect(await readFile(renamed)).toContain('# The note');
      expect((await readFile(links.uri)).trim()).toEqual(
        'Wiki [[was-renamed]] here.'
      );
    }, 2000);

    await deleteFile(renamed);
    await deleteFile(links.uri);
  });
});
