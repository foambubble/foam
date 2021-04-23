import * as vscode from 'vscode';
import { FoamWorkspace, createMarkdownParser, URI } from 'foam-core';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  createTestWorkspace,
  showInEditor,
} from '../test/test-utils';
import { LinkProvider } from './document-link-provider';
import { OPEN_COMMAND } from './utility-commands';
import { toVsCodeUri } from '../utils/vsc-utils';

describe('Document links provider', () => {
  const parser = createMarkdownParser([]);

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
    const { uri, content } = await createFile('');
    const ws = new FoamWorkspace().set(parser.parse(uri, content));

    const doc = await vscode.workspace.openTextDocument(uri);
    const provider = new LinkProvider(ws, parser);
    const links = provider.provideDocumentLinks(doc);

    expect(links.length).toEqual(0);
  });

  it('should not return any link for documents without links', async () => {
    const { uri, content } = await createFile(
      'This is some content without links'
    );
    const ws = new FoamWorkspace().set(parser.parse(uri, content));

    const doc = await vscode.workspace.openTextDocument(uri);
    const provider = new LinkProvider(ws, parser);
    const links = provider.provideDocumentLinks(doc);

    expect(links.length).toEqual(0);
  });

  it('should support wikilinks', async () => {
    const fileB = await createFile('# File B');
    const fileA = await createFile(`this is a link to [[${fileB.name}]].`);
    const noteA = parser.parse(fileA.uri, fileA.content);
    const noteB = parser.parse(fileB.uri, fileB.content);
    const ws = createTestWorkspace()
      .set(noteA)
      .set(noteB);

    const { doc } = await showInEditor(noteA.uri);
    const provider = new LinkProvider(ws, parser);
    const links = provider.provideDocumentLinks(doc);

    expect(links.length).toEqual(1);
    expect(links[0].target).toEqual(OPEN_COMMAND.asURI(noteB.uri));
    expect(links[0].range).toEqual(new vscode.Range(0, 18, 0, 27));
  });

  it('should support regular links', async () => {
    const fileB = await createFile('# File B');
    const fileA = await createFile(
      `this is a link to [a file](./${fileB.base}).`
    );
    const ws = createTestWorkspace()
      .set(parser.parse(fileA.uri, fileA.content))
      .set(parser.parse(fileB.uri, fileB.content));

    const { doc } = await showInEditor(fileA.uri);
    const provider = new LinkProvider(ws, parser);
    const links = provider.provideDocumentLinks(doc);

    expect(links.length).toEqual(1);
    expect(links[0].target).toEqual(OPEN_COMMAND.asURI(fileB.uri));
    expect(links[0].range).toEqual(new vscode.Range(0, 18, 0, 38));
  });

  it('should support placeholders', async () => {
    const fileA = await createFile(`this is a link to [[a placeholder]].`);
    const ws = new FoamWorkspace().set(parser.parse(fileA.uri, fileA.content));

    const { doc } = await showInEditor(fileA.uri);
    const provider = new LinkProvider(ws, parser);
    const links = provider.provideDocumentLinks(doc);

    expect(links.length).toEqual(1);
    expect(links[0].target).toEqual(
      OPEN_COMMAND.asURI(toVsCodeUri(URI.placeholder('a placeholder')))
    );
    expect(links[0].range).toEqual(new vscode.Range(0, 18, 0, 35));
  });
});
