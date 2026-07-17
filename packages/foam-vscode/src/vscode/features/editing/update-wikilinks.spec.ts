/* @unit-ready */

import * as vscode from 'vscode';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
  waitForNoteInFoamWorkspace,
  withModifiedFoamConfiguration,
} from '../../../test/test-utils-vscode';

describe('Update wikilink definitions', () => {
  beforeEach(async () => {
    await cleanWorkspace();
    await closeEditors();
  });

  afterEach(async () => {
    await cleanWorkspace();
    await closeEditors();
  });

  it('appends a new definition without adding a blank line to the definition block', async () => {
    const doc1 = await createFile('# First', ['doc1.md']);
    const doc2 = await createFile('# Second', ['doc2.md']);
    const doc3 = await createFile('# Third', ['doc3.md']);
    const source = await createFile(`[[doc1]] [[doc2]] [[doc3]]

[doc1]: doc1 "First"
[doc2]: doc2 "Second"
`);

    await waitForNoteInFoamWorkspace(doc1.uri);
    await waitForNoteInFoamWorkspace(doc2.uri);
    await waitForNoteInFoamWorkspace(doc3.uri);
    await waitForNoteInFoamWorkspace(source.uri);
    const { editor } = await showInEditor(source.uri);

    await withModifiedFoamConfiguration(
      'edit.linkReferenceDefinitions',
      'withoutExtensions',
      async () => {
        await vscode.commands.executeCommand(
          'foam-vscode.update-wikilink-definitions'
        );
      }
    );

    expect(editor.document.getText()).toBe(`[[doc1]] [[doc2]] [[doc3]]

[doc1]: doc1 "First"
[doc2]: doc2 "Second"
[doc3]: doc3 "Third"
`);
  });

  it('orders existing definitions by wikilink occurrence when configured', async () => {
    const doc1 = await createFile('# First', ['doc1.md']);
    const doc2 = await createFile('# Second', ['doc2.md']);
    const source = await createFile(`[[doc2]] [[doc1]]

[doc1]: doc1 "First"
[doc2]: doc2 "Second"
`);

    await waitForNoteInFoamWorkspace(doc1.uri);
    await waitForNoteInFoamWorkspace(doc2.uri);
    await waitForNoteInFoamWorkspace(source.uri);
    const { editor } = await showInEditor(source.uri);

    await withModifiedFoamConfiguration(
      'edit.linkReferenceDefinitions',
      'withoutExtensions',
      async () => {
        await withModifiedFoamConfiguration(
          'edit.linkReferenceDefinitionsSort',
          'occurrence',
          async () => {
            await vscode.commands.executeCommand(
              'foam-vscode.update-wikilink-definitions'
            );
          }
        );
      }
    );

    expect(editor.document.getText()).toBe(`[[doc2]] [[doc1]]

[doc2]: doc2 "Second"
[doc1]: doc1 "First"
`);
  });
});