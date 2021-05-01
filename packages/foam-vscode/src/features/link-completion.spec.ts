import * as vscode from 'vscode';
import { FoamGraph, FoamWorkspace } from 'foam-core';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
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
        links: [{ slug: 'placeholder text' }],
      })
    );
  const graph = FoamGraph.fromWorkspace(ws);

  beforeAll(async () => {
    await cleanWorkspace();
  });

  afterAll(async () => {
    ws.dispose();
    graph.dispose();
    await cleanWorkspace();
  });

  beforeEach(async () => {
    await closeEditors();
  });

  it('should not return any link for empty documents', async () => {
    const { uri } = await createFile('');
    const { doc } = await showInEditor(uri);
    const provider = new CompletionProvider(ws, graph);

    const links = await provider.provideCompletionItems(
      doc,
      new vscode.Position(0, 0)
    );

    expect(links).toBeNull();
  });

  it('should return notes and placeholders', async () => {
    const { uri } = await createFile('[[file]] [[');
    const { doc } = await showInEditor(uri);
    const provider = new CompletionProvider(ws, graph);

    const links = await provider.provideCompletionItems(
      doc,
      new vscode.Position(0, 11)
    );

    expect(links.items.length).toEqual(4);
  });

  it('should not return link outside the wiki-link brackets', async () => {
    const { uri } = await createFile('[[file]] then');
    const { doc } = await showInEditor(uri);
    const provider = new CompletionProvider(ws, graph);

    const links = await provider.provideCompletionItems(
      doc,
      new vscode.Position(0, 12)
    );

    expect(links).toBeNull();
  });
});
