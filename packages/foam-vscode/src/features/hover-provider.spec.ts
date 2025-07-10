import * as vscode from 'vscode';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { MarkdownResourceProvider } from '../core/services/markdown-provider';
import { FoamGraph } from '../core/model/graph';
import { FoamWorkspace } from '../core/model/workspace';
import { URI } from '../core/model/uri';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from '../test/test-utils-vscode';
import { readFileFromFs, TEST_DATA_DIR } from '../test/test-utils';
import { toVsCodeUri } from '../utils/vsc-utils';
import { HoverProvider } from './hover-provider';
import { FileDataStore } from '../test/test-datastore';

// We can't use createTestWorkspace from /packages/foam-vscode/src/test/test-utils.ts
// because we need a MarkdownResourceProvider with a real instance of FileDataStore.
const createWorkspace = () => {
  const dataStore = new FileDataStore(
    readFileFromFs,
    vscode.workspace.workspaceFolders[0].uri.fsPath
  );
  const parser = createMarkdownParser();
  const resourceProvider = new MarkdownResourceProvider(dataStore, parser);
  const workspace = new FoamWorkspace();
  workspace.registerProvider(resourceProvider);
  return workspace;
};

const getValue = (value: vscode.MarkdownString | vscode.MarkedString) =>
  value instanceof vscode.MarkdownString ? value.value : value;

describe('Hover provider', () => {
  const noCancelToken: vscode.CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: null,
  };
  const parser = createMarkdownParser();
  const hoverEnabled = () => true;

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

      const doc = await vscode.workspace.openTextDocument(toVsCodeUri(uri));
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

      const doc = await vscode.workspace.openTextDocument(toVsCodeUri(uri));
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
      (noteA as any).rawText = fileA.content;
      const noteB = parser.parse(fileB.uri, fileB.content);
      (noteB as any).rawText = fileB.content;
      const ws = createWorkspace().set(noteA).set(noteB);
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
      (noteA as any).rawText = fileA.content;
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

      const ws = createWorkspace().set(noteA).set(noteB);
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

      const ws = createWorkspace().set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(noteA.uri);
      const pos = new vscode.Position(0, 22); // Set cursor position on the wikilink.

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result.contents).toHaveLength(3);
      expect(getValue(result.contents[0])).toEqual(
        `This is some content from file B`
      );
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
      const ws = createWorkspace().set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(noteA.uri);
      const pos = new vscode.Position(0, 22); // Set cursor position on the link.

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result.contents).toHaveLength(3);
      expect(getValue(result.contents[0])).toEqual(
        `This is some content from file B`
      );
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
      const ws = createWorkspace().set(noteA).set(noteB);
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(noteA.uri);
      const pos = new vscode.Position(0, 22); // Set cursor position on the link.

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result.contents).toHaveLength(3);
      expect(getValue(result.contents[0])).toEqual(`The content of file B`);
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

      expect(result.contents).toHaveLength(3);
      expect(result.contents[0]).toEqual(null);
      expect(result.contents[1]).toEqual(null);
      expect(getValue(result.contents[2])).toMatch(
        "[Create note from template for 'wikilink'](command:foam-vscode.create-note?"
      );
      ws.dispose();
      graph.dispose();
    });

    it('should include other backlinks (but not self) to target wikilink', async () => {
      const fileA = await createFile(`This is some content`);
      const fileB = await createFile(
        `This is a direct link to [a file](./${fileA.base}).`
      );
      const fileC = await createFile(`Here is a wikilink to [[${fileA.name}]]`);

      const ws = createWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content))
        .set(parser.parse(fileC.uri, fileC.content));
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const pos = new vscode.Position(0, 29); // Set cursor position on the link.

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result.contents).toHaveLength(3);
      expect(getValue(result.contents[0])).toEqual(`This is some content`);
      expect(getValue(result.contents[1])).toMatch(
        /^Also referenced in 1 note:/
      );
      expect(result.contents[2]).toEqual(null);
      ws.dispose();
      graph.dispose();
    });

    it('should only add a note only once no matter how many links it has to the target', async () => {
      const fileA = await createFile(`This is some content`);
      const fileB = await createFile(`This is a link to [[${fileA.name}]].`);
      const fileC = await createFile(
        `This note is linked to [[${fileA.name}]] twice, here is the second: [[${fileA.name}]]`
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

      expect(result.contents).toHaveLength(3);
      expect(getValue(result.contents[1])).toMatch(
        /^Also referenced in 1 note:/
      );
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
      (fileA as any).rawText = fileA.content;
      (fileB as any).rawText = fileB.content;
      (fileC as any).rawText = fileC.content;
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const pos = new vscode.Position(0, 24); // Set cursor position on the link.

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result.contents).toHaveLength(3);
      expect(result.contents[0]).toEqual(null);
      expect(getValue(result.contents[1])).toMatch(
        /^Also referenced in 2 notes:/
      );
      expect(getValue(result.contents[2])).toMatch(
        "[Create note from template for 'placeholder'](command:foam-vscode.create-note?"
      );
      ws.dispose();
      graph.dispose();
    });
  });

  describe('with block identifiers', () => {
    it('should return hover content for a wikilink to a block', async () => {
      const fileWithBlockId = await createFile(
        '# Note with block id\n\nThis is a paragraph. ^block-1'
      );
      const linkContent = `[[${fileWithBlockId.name}#^block-1]]`;
      const fileLinkingToBlockId = await createFile(
        `# Note linking to block id\n\nThis note links to ${linkContent}.`
      );

      const noteWithBlockId = parser.parse(
        fileWithBlockId.uri,
        fileWithBlockId.content
      );
      const noteLinkingToBlockId = parser.parse(
        fileLinkingToBlockId.uri,
        fileLinkingToBlockId.content
      );

      const ws = createWorkspace()
        .set(noteWithBlockId)
        .set(noteLinkingToBlockId);
      const graph = FoamGraph.fromWorkspace(ws);

      const provider = new HoverProvider(hoverEnabled, ws, graph, parser);
      const { doc } = await showInEditor(noteLinkingToBlockId.uri);
      const linkPosition = fileLinkingToBlockId.content.indexOf(linkContent);
      const pos = doc.positionAt(linkPosition + 2);

      const result = await provider.provideHover(doc, pos, noCancelToken);

      expect(result.contents).toHaveLength(3);
      expect(getValue(result.contents[0])).toEqual(
        'This is a paragraph. ^block-1'
      );
      ws.dispose();
      graph.dispose();
    });
  });
});

describe('Mixed Scenario Hover', () => {
  const noCancelToken: vscode.CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: null,
  };
  it('should provide correct hover information for all link types', async () => {
    const parser = createMarkdownParser([]);
    const ws = createWorkspace();

    const mixedTargetFile = await createFile(
      await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'mixed-target.md')
      ),
      ['mixed-target.md']
    );
    const mixedOtherFile = await createFile(
      await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'mixed-other.md')
      ),
      ['mixed-other.md']
    );
    const mixedSourceFile = await createFile(
      await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'mixed-source.md')
      ),
      ['mixed-source.md']
    );

    const mixedTarget = parser.parse(
      mixedTargetFile.uri,
      mixedTargetFile.content
    );
    (mixedTarget as any).rawText = mixedTargetFile.content;
    const mixedOther = parser.parse(mixedOtherFile.uri, mixedOtherFile.content);
    (mixedOther as any).rawText = mixedOtherFile.content;
    const mixedSource = parser.parse(
      mixedSourceFile.uri,
      mixedSourceFile.content
    );
    (mixedSource as any).rawText = mixedSourceFile.content;

    ws.set(mixedTarget).set(mixedOther).set(mixedSource);
    const graph = FoamGraph.fromWorkspace(ws);
    const provider = new HoverProvider(() => true, ws, graph, parser);
    const { doc } = await showInEditor(mixedSource.uri);

    // Test hover on paragraph block link
    let pos = new vscode.Position(4, 30);
    let result = await provider.provideHover(doc, pos, noCancelToken);
    expect(getValue(result.contents[0])).toContain(
      'Here is a paragraph with a block identifier. ^para-block'
    );

    // Test hover on list item block link
    pos = new vscode.Position(5, 30);
    result = await provider.provideHover(doc, pos, noCancelToken);
    expect(getValue(result.contents[0])).toContain('- List item 2 ^list-block');
  });
});
