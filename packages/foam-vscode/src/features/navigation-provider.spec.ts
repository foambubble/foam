import * as vscode from 'vscode';
import { URI } from '../core/model/uri';
import { createTestWorkspace } from '../test/test-utils';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from '../test/test-utils-vscode';
import { NavigationProvider } from './navigation-provider';
import { OPEN_COMMAND } from './utility-commands';
import { toVsCodeUri } from '../utils/vsc-utils';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { FoamGraph } from '../core/model/graph';

describe('Document navigation', () => {
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
  describe('Document links provider', () => {
    it('should not return any link for empty documents', async () => {
      const { uri, content } = await createFile('');
      const ws = createTestWorkspace().set(parser.parse(uri, content));
      const graph = FoamGraph.fromWorkspace(ws);

      const doc = await vscode.workspace.openTextDocument(toVsCodeUri(uri));
      const provider = new NavigationProvider(ws, graph, parser);
      const links = provider.provideDocumentLinks(doc);

      expect(links.length).toEqual(0);
    });

    it('should not return any link for documents without links', async () => {
      const { uri, content } = await createFile(
        'This is some content without links'
      );
      const ws = createTestWorkspace().set(parser.parse(uri, content));
      const graph = FoamGraph.fromWorkspace(ws);

      const doc = await vscode.workspace.openTextDocument(toVsCodeUri(uri));
      const provider = new NavigationProvider(ws, graph, parser);
      const links = provider.provideDocumentLinks(doc);

      expect(links.length).toEqual(0);
    });

    it('should create links for wikilinks', async () => {
      const fileA = await createFile('# File A', ['file-a.md']);
      const fileB = await createFile(`this is a link to [[${fileA.name}]].`);
      const ws = createTestWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileA.uri, fileB.content));
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const provider = new NavigationProvider(ws, graph, parser);
      const links = provider.provideDocumentLinks(doc);

      expect(links.length).toEqual(1);
      expect(links[0].target).toEqual(OPEN_COMMAND.asURI(fileA.uri));
      expect(links[0].range).toEqual(new vscode.Range(0, 20, 0, 26));
    });

    it('should create links for placeholders', async () => {
      const fileA = await createFile(`this is a link to [[a placeholder]].`);
      const ws = createTestWorkspace().set(
        parser.parse(fileA.uri, fileA.content)
      );
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(fileA.uri);
      const provider = new NavigationProvider(ws, graph, parser);
      const links = provider.provideDocumentLinks(doc);

      expect(links.length).toEqual(1);
      expect(links[0].target).toEqual(
        OPEN_COMMAND.asURI(URI.placeholder('a placeholder'))
      );
      expect(links[0].range).toEqual(new vscode.Range(0, 20, 0, 33));
    });
  });

  describe('definition provider', () => {
    it('should not create a definition for a placeholder', async () => {
      const fileA = await createFile(`this is a link to [[placeholder]].`);
      const ws = createTestWorkspace().set(
        parser.parse(fileA.uri, fileA.content)
      );
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(fileA.uri);
      const provider = new NavigationProvider(ws, graph, parser);
      const definitions = await provider.provideDefinition(
        doc,
        new vscode.Position(0, 22)
      );

      expect(definitions).toBeUndefined();
    });
    it('should create a definition for a wikilink', async () => {
      const fileA = await createFile('# File A');
      const fileB = await createFile(`this is a link to [[${fileA.name}]].`);
      const ws = createTestWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content));
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const provider = new NavigationProvider(ws, graph, parser);
      const definitions = await provider.provideDefinition(
        doc,
        new vscode.Position(0, 22)
      );

      expect(definitions.length).toEqual(1);
      expect(definitions[0].targetUri).toEqual(toVsCodeUri(fileA.uri));
      // target the whole file
      expect(definitions[0].targetRange).toEqual(new vscode.Range(0, 0, 0, 8));
      // select nothing
      expect(definitions[0].targetSelectionRange).toEqual(
        new vscode.Range(0, 0, 0, 0)
      );
    });

    it('should create a definition for a regular link', async () => {
      const fileA = await createFile('# File A');
      const fileB = await createFile(
        `this is a link to [a file](./${fileA.base}).`
      );
      const ws = createTestWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content));
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const provider = new NavigationProvider(ws, graph, parser);

      const definitions = await provider.provideDefinition(
        doc,
        new vscode.Position(0, 22)
      );

      expect(definitions.length).toEqual(1);
      expect(definitions[0].targetUri).toEqual(toVsCodeUri(fileA.uri));
    });

    it('should support wikilinks that have an alias', async () => {
      const fileA = await createFile("# File A that's aliased");
      const fileB = await createFile(
        `this is a link to [[${fileA.name}|alias]].`
      );

      const ws = createTestWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content));
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const provider = new NavigationProvider(ws, graph, parser);
      const definitions = await provider.provideDefinition(
        doc,
        new vscode.Position(0, 22)
      );

      expect(definitions.length).toEqual(1);
      expect(definitions[0].targetUri).toEqual(toVsCodeUri(fileA.uri));
    });

    it('should support wikilink aliases in tables using escape character', async () => {
      const fileA = await createFile('# File that has to be aliased');
      const fileB = await createFile(`
  | Col A | ColB |
  | --- | --- |
  | [[${fileA.name}\\|alias]] | test |
    `);
      const ws = createTestWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content));
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const provider = new NavigationProvider(ws, graph, parser);
      const definitions = await provider.provideDefinition(
        doc,
        new vscode.Position(3, 10)
      );

      expect(definitions.length).toEqual(1);
      expect(definitions[0].targetUri).toEqual(toVsCodeUri(fileA.uri));
    });
  });

  describe('reference provider', () => {
    it('should provide references for wikilinks', async () => {
      const fileA = await createFile('The content of File A');
      const fileB = await createFile(
        `File B is connected to [[${fileA.name}]] and has a [[placeholder]].`
      );
      const fileC = await createFile(
        `File C is also connected to [[${fileA.name}]].`
      );
      const fileD = await createFile(`File C has a [[placeholder]].`);

      const ws = createTestWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content))
        .set(parser.parse(fileC.uri, fileC.content))
        .set(parser.parse(fileD.uri, fileD.content));
      const graph = FoamGraph.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const provider = new NavigationProvider(ws, graph, parser);

      const refs = await provider.provideReferences(
        doc,
        new vscode.Position(0, 26)
      );
      expect(refs.length).toEqual(2);
      expect(refs[0]).toEqual({
        uri: toVsCodeUri(fileB.uri),
        range: new vscode.Range(0, 23, 0, 23 + 9),
      });
    });
    it.todo('should provide references for placeholders');
  });
});
