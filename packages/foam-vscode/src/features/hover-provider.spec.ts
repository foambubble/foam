import * as vscode from 'vscode';
import {
  FoamWorkspace,
  createMarkdownParser,
  Matcher,
  MarkdownResourceProvider,
  URI,
} from 'foam-core';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  createTestWorkspace,
  showInEditor,
} from '../test/test-utils';
import { HoverProvider } from './hover-provider';

describe('Hover provider', () => {
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

  it('should not return hover content for empty documents', async () => {
    const { uri, content } = await createFile('');
    const ws = new FoamWorkspace().set(parser.parse(uri, content));

    const provider = new HoverProvider(ws, parser);

    const doc = await vscode.workspace.openTextDocument(uri);
    const pos = new vscode.Position(0, 0);
    const result: vscode.ProviderResult<vscode.Hover> = provider.provideHover(
      doc,
      pos,
      noCancelToken
    );

    expect(result).toBeUndefined();
  });

  it('should not return hover content for documents without links', async () => {
    const { uri, content } = await createFile(
      'This is some content without links'
    );
    const ws = new FoamWorkspace().set(parser.parse(uri, content));

    const provider = new HoverProvider(ws, parser);

    const doc = await vscode.workspace.openTextDocument(uri);
    const pos = new vscode.Position(0, 0);
    const result: vscode.ProviderResult<vscode.Hover> = provider.provideHover(
      doc,
      pos,
      noCancelToken
    );

    expect(result).toBeUndefined();
  });

  it('should return hover content for a wikilink', async () => {
    const fileBContent = `# File B Title
  ---
  tags: my-tag1 my-tag2
  ---

The content of file B
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
cccccccccccccccccccccccccccccccccccccccc
dddddddddddddddddddddddddddddddddddddddd
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`;

    const fileB = await createFile(fileBContent);
    const fileA = await createFile(
      `this is a link to [[${fileB.name}]] end of the line.`
    );
    const noteA = parser.parse(fileA.uri, fileA.content);
    const noteB = parser.parse(fileB.uri, fileB.content);

    // Create custom workspace fixture.
    const workspace = new FoamWorkspace();
    const matcher = new Matcher([URI.file('/')], ['**/*']);
    const resourceProvider: MarkdownResourceProvider = new MarkdownResourceProvider(
      matcher,
      undefined,
      undefined,
      {
        read: _ => Promise.resolve(fileBContent),
        list: _ => Promise.resolve([]),
      }
    );

    workspace.registerProvider(resourceProvider);

    workspace.set(noteA).set(noteB);

    const provider = new HoverProvider(workspace, parser);
    const { doc } = await showInEditor(noteA.uri);
    const pos = new vscode.Position(0, 22); // Set cursor position on the wikilink.

    const promiseResult = provider.provideHover(
      doc,
      pos,
      noCancelToken
    ) as Promise<vscode.Hover>;

    // As long as the tests are running with vscode 1.53.0 , MarkdownString is not available.
    // See file://./../test/run-tests.ts and getNoteTooltip at file://./../utils.ts
    const simpleTooltipExpectedFormat =
      'File B Title --- tags: my-tag1 my-tag2 --- The content of file B aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb cccccccccccccccccccccccccccccccccccccccc dddddddddddd...';
    return promiseResult.then(result => {
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual(simpleTooltipExpectedFormat);
    });

    // If vscode test version >= STABLE_MARKDOWN_STRING_API_VERSION (1.52.1)
    /*
    const markdownTooltipExpectedFormat = `# File B Title
  ---
  tags: my-tag1 my-tag2
  ---

The content of file B
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
cccccccccccccccccccccccccccccccccccccccc
dddddddddddddddddddddddddddddddddddddddd
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`;

    return promiseResult.then(result => {
      const md = (result.contents as unknown) as vscode.MarkdownString[];
      expect(md).toHaveLength(1);
      expect(md[0].value).toEqual(markdownTooltipExpectedFormat);
    });
    */
  });

  it('should not return hover content when the cursor is not placed on a wikilink', async () => {
    const fileB = await createFile('# File B\nThe content of file B');
    const fileA = await createFile(
      `this is a link to [[${fileB.name}]] end of the line.`
    );
    const noteA = parser.parse(fileA.uri, fileA.content);
    const noteB = parser.parse(fileB.uri, fileB.content);
    const ws = createTestWorkspace()
      .set(noteA)
      .set(noteB);

    const provider = new HoverProvider(ws, parser);
    const { doc } = await showInEditor(noteA.uri);
    const pos = new vscode.Position(0, 11); // Set cursor position beside the wikilink.

    const result: vscode.ProviderResult<vscode.Hover> = provider.provideHover(
      doc,
      pos,
      noCancelToken
    );
    expect(result).toBeUndefined();
  });

  it('should not return hover content for a regular link', async () => {
    const fileB = await createFile('# File B\nThe content of file B');
    const fileA = await createFile(
      `this is a link to [a file](./${fileB.base}).`
    );
    const noteA = parser.parse(fileA.uri, fileA.content);
    const noteB = parser.parse(fileB.uri, fileB.content);
    const ws = createTestWorkspace()
      .set(noteA)
      .set(noteB);

    const provider = new HoverProvider(ws, parser);
    const { doc } = await showInEditor(noteA.uri);
    const pos = new vscode.Position(0, 22); // Set cursor position on the link.

    const result: vscode.ProviderResult<vscode.Hover> = provider.provideHover(
      doc,
      pos,
      noCancelToken
    );
    expect(result).toBeUndefined();
  });

  it('should not return hover content for a placeholder', async () => {
    const fileA = await createFile(
      `this is a link to [[a placeholder]] end of the line.`
    );
    const noteA = parser.parse(fileA.uri, fileA.content);
    const ws = createTestWorkspace().set(noteA);

    const provider = new HoverProvider(ws, parser);
    const { doc } = await showInEditor(noteA.uri);
    const pos = new vscode.Position(0, 22); // Set cursor position on the placeholder.

    const result: vscode.ProviderResult<vscode.Hover> = provider.provideHover(
      doc,
      pos,
      noCancelToken
    );
    expect(result).toBeUndefined();
  });
});

const noCancelToken: vscode.CancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: null,
};
