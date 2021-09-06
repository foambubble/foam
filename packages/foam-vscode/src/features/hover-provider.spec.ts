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
  showInEditor,
} from '../test/test-utils';
import { HoverProvider } from './hover-provider';

describe('Hover provider', () => {
  const noCancelToken: vscode.CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: null,
  };
  const parser = createMarkdownParser([]);
  const hoverEnabled = () => true;

  // We can't use createTestWorkspace from /packages/foam-vscode/src/test/test-utils.ts
  // because we need a fully instantiated MarkdownResourceProvider (with a real instance of ResourceParser).
  const createWorkspace = () => {
    const matcher = new Matcher([URI.file('/')], ['**/*']);
    const resourceProvider = new MarkdownResourceProvider(matcher);
    const workspace = new FoamWorkspace();
    workspace.registerProvider(resourceProvider);
    return workspace;
  };

  const fileContent = `# File B Title
  ---
  tags: my-tag1 my-tag2
  ---

The content of file B
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
cccccccccccccccccccccccccccccccccccccccc
dddddddddddddddddddddddddddddddddddddddd
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`;

  // Fixture needed as long tests are running with vscode 1.53.0 (MarkdownString is not available)
  const simpleTooltipExpectedFormat =
    'File B Title --- tags: my-tag1 my-tag2 --- The content of file B aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ' +
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb cccccccccccccccccccccccccccccccccccccccc dddddddddddd...';

  // Fixture to use when tests are running with vscode version >= STABLE_MARKDOWN_STRING_API_VERSION (1.52.1)
  /*const markdownTooltipExpectedFormat = `# File B Title
  ---
  tags: my-tag1 my-tag2
  ---

The content of file B
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
cccccccccccccccccccccccccccccccccccccccc
dddddddddddddddddddddddddddddddddddddddd
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`;*/

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
    const ws = createWorkspace().set(parser.parse(uri, content));
    const provider = new HoverProvider(hoverEnabled, ws, parser);

    const doc = await vscode.workspace.openTextDocument(uri);
    const pos = new vscode.Position(0, 0);
    const result = await provider.provideHover(doc, pos, noCancelToken);

    expect(result).toBeUndefined();
  });

  it('should not return hover content for documents without links', async () => {
    const { uri, content } = await createFile(
      'This is some content without links'
    );
    const ws = createWorkspace().set(parser.parse(uri, content));

    const provider = new HoverProvider(hoverEnabled, ws, parser);

    const doc = await vscode.workspace.openTextDocument(uri);
    const pos = new vscode.Position(0, 0);
    const result = await provider.provideHover(doc, pos, noCancelToken);

    expect(result).toBeUndefined();
  });

  it('should return hover content for a wikilink', async () => {
    const fileB = await createFile(fileContent);
    const fileA = await createFile(
      `this is a link to [[${fileB.name}]] end of the line.`
    );
    const noteA = parser.parse(fileA.uri, fileA.content);
    const noteB = parser.parse(fileB.uri, fileB.content);

    const ws = createWorkspace()
      .set(noteA)
      .set(noteB);

    const { doc } = await showInEditor(noteA.uri);
    const pos = new vscode.Position(0, 22); // Set cursor position on the wikilink.

    const providerNotEnabled = new HoverProvider(() => false, ws, parser);
    expect(
      await providerNotEnabled.provideHover(doc, pos, noCancelToken)
    ).toBeUndefined();

    const provider = new HoverProvider(hoverEnabled, ws, parser);
    const result = await provider.provideHover(doc, pos, noCancelToken);

    expect(result.contents).toHaveLength(1);
    const content: vscode.MarkedString = result.contents[0];

    // As long as the tests are running with vscode 1.53.0 , MarkdownString is not available.
    // See file://./../test/run-tests.ts and getNoteTooltip at file://./../utils.ts
    expect(content).toEqual(simpleTooltipExpectedFormat);

    // If vscode test version >= STABLE_MARKDOWN_STRING_API_VERSION (1.52.1)
    // expect((content as vscode.MarkdownString).value).toEqual(markdownTooltipExpectedFormat);
  });

  it('should return hover content for a regular link', async () => {
    const fileB = await createFile(fileContent);
    const fileA = await createFile(
      `this is a link to [a file](./${fileB.base}).`
    );
    const noteA = parser.parse(fileA.uri, fileA.content);
    const noteB = parser.parse(fileB.uri, fileB.content);
    const ws = createWorkspace()
      .set(noteA)
      .set(noteB);

    const { doc } = await showInEditor(noteA.uri);
    const pos = new vscode.Position(0, 22); // Set cursor position on the link.

    const provider = new HoverProvider(hoverEnabled, ws, parser);
    const result = await provider.provideHover(doc, pos, noCancelToken);

    expect(result.contents).toHaveLength(1);
    const content: vscode.MarkedString = result.contents[0];

    // As long as the tests are running with vscode 1.53.0 , MarkdownString is not available.
    // See file://./../test/run-tests.ts and getNoteTooltip at file://./../utils.ts
    expect(content).toEqual(simpleTooltipExpectedFormat);

    // If vscode test version >= STABLE_MARKDOWN_STRING_API_VERSION (1.52.1)
    // expect((content as vscode.MarkdownString).value).toEqual(markdownTooltipExpectedFormat);
  });

  it('should not return hover content when the cursor is not placed on a wikilink', async () => {
    const fileB = await createFile('# File B\nThe content of file B');
    const fileA = await createFile(
      `this is a link to [[${fileB.name}]] end of the line.`
    );
    const noteA = parser.parse(fileA.uri, fileA.content);
    const noteB = parser.parse(fileB.uri, fileB.content);
    const ws = createWorkspace()
      .set(noteA)
      .set(noteB);

    const provider = new HoverProvider(hoverEnabled, ws, parser);
    const { doc } = await showInEditor(noteA.uri);
    const pos = new vscode.Position(0, 11); // Set cursor position beside the wikilink.

    const result = await provider.provideHover(doc, pos, noCancelToken);
    expect(result).toBeUndefined();
  });

  it('should not return hover content for a placeholder', async () => {
    const fileA = await createFile(
      `this is a link to [[a placeholder]] end of the line.`
    );
    const noteA = parser.parse(fileA.uri, fileA.content);
    const ws = createWorkspace().set(noteA);

    const provider = new HoverProvider(hoverEnabled, ws, parser);
    const { doc } = await showInEditor(noteA.uri);
    const pos = new vscode.Position(0, 22); // Set cursor position on the placeholder.

    const result = await provider.provideHover(doc, pos, noCancelToken);
    expect(result).toBeUndefined();
  });
});
