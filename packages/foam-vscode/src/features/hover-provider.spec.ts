import * as vscode from 'vscode';
import {
  createMarkdownParser,
  MarkdownResourceProvider,
} from '../core/markdown-provider';
import { FoamGraph } from '../core/model/graph';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';
import { Matcher } from '../core/services/datastore';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from '../test/test-utils-vscode';
import { HoverProvider } from './hover-provider';

// We can't use createTestWorkspace from /packages/foam-vscode/src/test/test-utils.ts
// because we need a fully instantiated MarkdownResourceProvider (with a real instance of ResourceParser).
const createWorkspace = () => {
  const matcher = new Matcher([URI.file('/')], ['**/*']);
  const resourceProvider = new MarkdownResourceProvider(matcher);
  const workspace = new FoamWorkspace();
  workspace.registerProvider(resourceProvider);
  return workspace;
};

describe('Hover provider', () => {
  const noCancelToken: vscode.CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: null,
  };
  const parser = createMarkdownParser([]);
  const hoverEnabled = () => true;

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

  describe('not returning hovers', () => {
    it('should not return hover content for empty documents', async () => {
      const { uri, content } = await createFile('');
      const ws = createWorkspace().set(parser.parse(uri, content));
      const graph = FoamGraph.fromWorkspace(ws);
      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);

      const doc = await vscode.workspace.openTextDocument(uri);
      const pos = new vscode.Position(0, 0);
      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result).toBeUndefined();
      ws.dispose();
      graph.dispose();
    });

    it('should not return hover content for documents without links', async () => {
      const { uri, content } = await createFile(
        'This is some content without links'
      );
      const ws = createWorkspace().set(parser.parse(uri, content));
      const graph = FoamGraph.fromWorkspace(ws);

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);

      const doc = await vscode.workspace.openTextDocument(uri);
      const pos = new vscode.Position(0, 0);
      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result).toBeUndefined();
      ws.dispose();
      graph.dispose();
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
      const graph = FoamGraph.fromWorkspace(ws);

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const { doc } = await showInEditor(noteA.uri);
      const pos = new vscode.Position(0, 11); // Set cursor position beside the wikilink.

      const result = await provider.provideHover(doc, pos, noCancelToken);
      expect(result).toBeUndefined();
      ws.dispose();
      graph.dispose();
    });

    it('should not return hover content for a placeholder', async () => {
      const fileA = await createFile(
        `this is a link to [[a placeholder]] end of the line.`
      );
      const noteA = parser.parse(fileA.uri, fileA.content);
      const ws = createWorkspace().set(noteA);
      const graph = FoamGraph.fromWorkspace(ws);

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const { doc } = await showInEditor(noteA.uri);
      const pos = new vscode.Position(0, 22); // Set cursor position on the placeholder.

      const result = await provider.provideHover(doc, pos, noCancelToken);
      expect(result.contents[0]).toBeNull();
      ws.dispose();
      graph.dispose();
    });

    it('should not return hover when provider is disabled', async () => {
      const fileB = await createFile(`this is my file content`);
      const fileA = await createFile(
        `this is a link to [[${fileB.name}]] end of the line.`
      );
      const noteA = parser.parse(fileA.uri, fileA.content);
      const noteB = parser.parse(fileB.uri, fileB.content);

      const ws = createWorkspace()
        .set(noteA)
        .set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(noteA.uri);
      const pos = new vscode.Position(0, 22); // Set cursor position on the wikilink.

      const disabledProvider = new HoverProvider(
        () => false,
        ws,
        graph,
        parser
      );
      expect(
        await disabledProvider.provideHover(doc, pos, noCancelToken)
      ).toBeUndefined();
      ws.dispose();
      graph.dispose();
    });
  });

  describe('wikilink content preview', () => {
    it('should return hover content for a wikilink', async () => {
      const fileB = await createFile(`This is some content from file B`);
      const fileA = await createFile(
        `this is a link to [[${fileB.name}]] end of the line.`
      );
      const noteA = parser.parse(fileA.uri, fileA.content);
      const noteB = parser.parse(fileB.uri, fileB.content);

      const ws = createWorkspace()
        .set(noteA)
        .set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(noteA.uri);
      const pos = new vscode.Position(0, 22); // Set cursor position on the wikilink.

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result.contents).toHaveLength(2);
      expect(result.contents[0]).toEqual(`This is some content from file B`);
      ws.dispose();
      graph.dispose();
    });

    it('should return hover content for a regular link', async () => {
      const fileB = await createFile(`This is some content from file B`);
      const fileA = await createFile(
        `this is a link to [a file](./${fileB.base}).`
      );
      const noteA = parser.parse(fileA.uri, fileA.content);
      const noteB = parser.parse(fileB.uri, fileB.content);
      const ws = createWorkspace()
        .set(noteA)
        .set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(noteA.uri);
      const pos = new vscode.Position(0, 22); // Set cursor position on the link.

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result.contents).toHaveLength(2);
      expect(result.contents[0]).toEqual(`This is some content from file B`);
      ws.dispose();
      graph.dispose();
    });

    it('should remove YAML properties from preview', async () => {
      const fileB = await createFile(`---
tags: my-tag1 my-tag2
---      
    
The content of file B`);
      const fileA = await createFile(
        `this is a link to [a file](./${fileB.base}).`
      );
      const noteA = parser.parse(fileA.uri, fileA.content);
      const noteB = parser.parse(fileB.uri, fileB.content);
      const ws = createWorkspace()
        .set(noteA)
        .set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(noteA.uri);
      const pos = new vscode.Position(0, 22); // Set cursor position on the link.

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result.contents).toHaveLength(2);
      expect(result.contents[0]).toEqual(`The content of file B`);
      ws.dispose();
      graph.dispose();
    });
  });

  describe('backlink inclusion in hover', () => {
    it('should not include references if there are none', async () => {
      const fileA = await createFile(`This is some [[wikilink]]`);

      const ws = createWorkspace().set(parser.parse(fileA.uri, fileA.content));
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(fileA.uri);
      const pos = new vscode.Position(0, 20); // Set cursor position on the link.

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result.contents).toHaveLength(2);
      expect(result.contents[0]).toEqual(null);
      expect(result.contents[1]).toEqual(null);
      ws.dispose();
      graph.dispose();
    });

    it('should include other backlinks (but not self) to target wikilink', async () => {
      const fileA = await createFile(`This is some content`);
      const fileB = await createFile(
        `this is a link to [a file](./${fileA.base}).`
      );
      const fileC = await createFile(
        `this is another note linked to [[${fileA.name}]]`
      );

      const ws = createWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content))
        .set(parser.parse(fileC.uri, fileC.content));
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const pos = new vscode.Position(0, 22); // Set cursor position on the link.

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result.contents).toHaveLength(2);
      expect(result.contents[0]).toEqual(`This is some content`);
      expect(result.contents[1]).toMatch(/^Also referenced in 1 note:/);
      ws.dispose();
      graph.dispose();
    });

    it('should work for placeholders', async () => {
      const fileA = await createFile(`Some content and a [[placeholder]]`);
      const fileB = await createFile(`More content to a [[placeholder]]`);
      const fileC = await createFile(`Yet more content to a [[placeholder]]`);

      const ws = createWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content))
        .set(parser.parse(fileC.uri, fileC.content));
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const pos = new vscode.Position(0, 24); // Set cursor position on the link.

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result.contents).toHaveLength(2);
      expect(result.contents[0]).toEqual(null);
      expect(result.contents[1]).toMatch(/^Also referenced in 2 notes:/);

      ws.dispose();
      graph.dispose();
    });
  });
});
