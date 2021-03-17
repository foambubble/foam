import * as vscode from 'vscode';
import { FoamWorkspace, createMarkdownParser, uris } from 'foam-core';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from '../test/test-utils';
import { LinkProvider } from './document-link-provider';
import { OPEN_COMMAND } from './utility-commands';

describe('Document links provider', () => {
  const parser = createMarkdownParser([]);

  beforeAll(async () => {
    await cleanWorkspace();
  });

  afterAll(async () => {
    await cleanWorkspace;
  });

  beforeEach(async () => {
    await closeEditors();
  });

  it('should not return any link for empty documents', async () => {
    const ws = new FoamWorkspace();
    const { uri, content } = await createFile('');
    ws.set(parser.parse(uri, content)).resolveLinks();

    const doc = await vscode.workspace.openTextDocument(uri);
    const provider = new LinkProvider(ws, parser);
    const links = provider.provideDocumentLinks(doc);

    expect(links.length).toEqual(0);
  });

  it('should not return any link for documents without links', async () => {
    const ws = new FoamWorkspace();
    const { uri, content } = await createFile(
      'This is some content without links'
    );
    ws.set(parser.parse(uri, content)).resolveLinks();

    const doc = await vscode.workspace.openTextDocument(uri);
    const provider = new LinkProvider(ws, parser);
    const links = provider.provideDocumentLinks(doc);

    expect(links.length).toEqual(0);
  });

  it('should support wikilinks', async () => {
    const ws = new FoamWorkspace();
    const fileB = await createFile('# File B');
    const fileA = await createFile(`this is a link to [[${fileB.name}]].`);
    const noteA = parser.parse(fileA.uri, fileA.content);
    const noteB = parser.parse(fileB.uri, fileB.content);
    ws.set(noteA)
      .set(noteB)
      .resolveLinks();

    const { doc } = await showInEditor(noteA.uri);
    const provider = new LinkProvider(ws, parser);
    const links = provider.provideDocumentLinks(doc);

    expect(links.length).toEqual(1);
    expect(links[0].target).toEqual(OPEN_COMMAND.asURI(fileB.uri));
    expect(links[0].range).toEqual(new vscode.Range(0, 18, 0, 27));
  });

  it('should support regular links', async () => {
    const ws = new FoamWorkspace();
    const fileB = await createFile('# File B');
    const fileA = await createFile(
      `this is a link to [a file](./${fileB.base}).`
    );
    ws.set(parser.parse(fileA.uri, fileA.content))
      .set(parser.parse(fileB.uri, fileB.content))
      .resolveLinks();

    const { doc } = await showInEditor(fileA.uri);
    const provider = new LinkProvider(ws, parser);
    const links = provider.provideDocumentLinks(doc);

    expect(links.length).toEqual(1);
    expect(links[0].target).toEqual(OPEN_COMMAND.asURI(fileB.uri));
    expect(links[0].range).toEqual(new vscode.Range(0, 18, 0, 38));
  });

  it('should support placeholders', async () => {
    const ws = new FoamWorkspace();
    const fileA = await createFile(`this is a link to [[a placeholder]].`);
    ws.set(parser.parse(fileA.uri, fileA.content)).resolveLinks();

    const { doc } = await showInEditor(fileA.uri);
    const provider = new LinkProvider(ws, parser);
    const links = provider.provideDocumentLinks(doc);

    expect(links.length).toEqual(1);
    expect(links[0].target).toEqual(
      OPEN_COMMAND.asURI(uris.placeholderUri('a placeholder'))
    );
    expect(links[0].range).toEqual(new vscode.Range(0, 18, 0, 35));
  });
});
