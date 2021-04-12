import * as vscode from 'vscode';
import { FoamWorkspace } from 'foam-core';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  createPlaceholder,
  createTestNote,
  showInEditor,
} from '../test/test-utils';
import { CompletionProvider } from './link-completion';

describe('Link Completion', () => {
  const root = vscode.workspace.workspaceFolders[0].uri;
  const ws = new FoamWorkspace();
  ws.set(
    createTestNote({
      root,
      uri: 'file-name.md',
    })
  )
    .set(
      createTestNote({
        root,
        uri: 'File name with spaces.md',
      })
    )
    .set(
      createTestNote({
        root,
        uri: 'path/to/file.md',
      })
    )
    .set(createPlaceholder('placeholder text'))
    .resolveLinks();

  beforeAll(async () => {
    await cleanWorkspace();
  });

  afterAll(async () => {
    await cleanWorkspace();
  });

  beforeEach(async () => {
    await closeEditors();
  });

  it('should not return any link for empty documents', async () => {
    const { uri } = await createFile('');
    const { doc } = await showInEditor(uri);
    const provider = new CompletionProvider(ws);

    const links = await provider.provideCompletionItems(
      doc,
      new vscode.Position(0, 0)
    );

    expect(links).toBeNull();
  });

  it('should return notes and placeholders', async () => {
    const { uri } = await createFile('[[');
    const { doc } = await showInEditor(uri);
    const provider = new CompletionProvider(ws);

    const links = await provider.provideCompletionItems(
      doc,
      new vscode.Position(0, 2)
    );

    expect(links.items.length).toEqual(4);
  });
});
