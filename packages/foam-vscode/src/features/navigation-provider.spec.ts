import * as vscode from 'vscode';
import { createTestWorkspace } from '../test/test-utils';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from '../test/test-utils-vscode';
import { NavigationProvider } from './navigation-provider';
import { toVsCodeUri } from '../utils/vsc-utils';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { FoamGraph } from '../core/model/graph';
import { commandAsURI } from '../utils/commands';
import { CREATE_NOTE_COMMAND } from './commands/create-note';
import { Location } from '../core/model/location';
import { FoamTags } from '../core/model/tags';

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
      const tags = FoamTags.fromWorkspace(ws);

      const doc = await vscode.workspace.openTextDocument(toVsCodeUri(uri));
      const provider = new NavigationProvider(ws, graph, parser, tags);
      const links = provider.provideDocumentLinks(doc);

      expect(links.length).toEqual(0);
    });

    it('should not return any link for documents without links', async () => {
      const { uri, content } = await createFile(
        'This is some content without links'
      );
      const ws = createTestWorkspace().set(parser.parse(uri, content));
      const graph = FoamGraph.fromWorkspace(ws);
      const tags = FoamTags.fromWorkspace(ws);

      const doc = await vscode.workspace.openTextDocument(toVsCodeUri(uri));
      const provider = new NavigationProvider(ws, graph, parser, tags);
      const links = provider.provideDocumentLinks(doc);

      expect(links.length).toEqual(0);
    });

    it('should not create links for wikilinks, as this is managed by the definition provider', async () => {
      const fileA = await createFile('# File A', ['file-a.md']);
      const fileB = await createFile(`this is a link to [[${fileA.name}]].`);
      const ws = createTestWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileA.uri, fileB.content));
      const graph = FoamGraph.fromWorkspace(ws);
      const tags = FoamTags.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const provider = new NavigationProvider(ws, graph, parser, tags);
      const links = provider.provideDocumentLinks(doc);

      expect(links.length).toEqual(0);
    });

    it('should create links for placeholders', async () => {
      const fileA = await createFile(`this is a link to [[a placeholder]].`);
      const noteA = parser.parse(fileA.uri, fileA.content);
      const ws = createTestWorkspace().set(noteA);
      const graph = FoamGraph.fromWorkspace(ws);
      const tags = FoamTags.fromWorkspace(ws);

      const { doc } = await showInEditor(fileA.uri);
      const provider = new NavigationProvider(ws, graph, parser, tags);
      const links = provider.provideDocumentLinks(doc);

      expect(links.length).toEqual(1);
      expect(links[0].target).toEqual(
        commandAsURI(
          CREATE_NOTE_COMMAND.forPlaceholder(
            Location.forObjectWithRange(noteA.uri, noteA.links[0]),
            '.md',
            {
              onFileExists: 'open',
            }
          )
        )
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
      const tags = FoamTags.fromWorkspace(ws);

      const { doc } = await showInEditor(fileA.uri);
      const provider = new NavigationProvider(ws, graph, parser, tags);
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
      const tags = FoamTags.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const provider = new NavigationProvider(ws, graph, parser, tags);
      const definitions = await provider.provideDefinition(
        doc,
        new vscode.Position(0, 22)
      );

      expect(definitions.length).toEqual(1);
      expect(definitions[0].targetUri).toEqual(toVsCodeUri(fileA.uri));
      // target the beginning of the file
      expect(definitions[0].targetRange).toEqual(new vscode.Range(0, 0, 0, 0));
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
      const tags = FoamTags.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const provider = new NavigationProvider(ws, graph, parser, tags);

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
      const tags = FoamTags.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const provider = new NavigationProvider(ws, graph, parser, tags);
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
      const tags = FoamTags.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const provider = new NavigationProvider(ws, graph, parser, tags);
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
      const tags = FoamTags.fromWorkspace(ws);

      const { doc } = await showInEditor(fileB.uri);
      const provider = new NavigationProvider(ws, graph, parser, tags);

      const refs = await provider.provideReferences(
        doc,
        new vscode.Position(0, 26)
      );

      // Make sure the references are sorted by position, so we match the right expectation
      refs.sort((a, b) => a.range.start.character - b.range.start.character);

      expect(refs.length).toEqual(2);
      expect(refs[0]).toEqual({
        uri: toVsCodeUri(fileB.uri),
        range: new vscode.Range(0, 23, 0, 23 + 9),
      });
    });

    it('should provide references for tags', async () => {
      const fileA = await createFile('This file has #tag1 and #tag2.');
      const fileB = await createFile(
        'This file also has #tag1 and other content.'
      );
      const fileC = await createFile('This file has #tag2 and #tag3.');

      const ws = createTestWorkspace()
        .set(parser.parse(fileA.uri, fileA.content))
        .set(parser.parse(fileB.uri, fileB.content))
        .set(parser.parse(fileC.uri, fileC.content));
      const graph = FoamGraph.fromWorkspace(ws);
      const tags = FoamTags.fromWorkspace(ws);

      const { doc } = await showInEditor(fileA.uri);
      const provider = new NavigationProvider(ws, graph, parser, tags);

      // Test references for #tag1 (position 15 is within the #tag1 text)
      const tag1Refs = await provider.provideReferences(
        doc,
        new vscode.Position(0, 15)
      );

      expect(tag1Refs.length).toEqual(2); // #tag1 appears in fileA and fileB

      const refUris = tag1Refs.map(ref => ref.uri);
      expect(refUris).toContain(toVsCodeUri(fileA.uri));
      expect(refUris).toContain(toVsCodeUri(fileB.uri));
    });

    it('should provide references for tags with different positions', async () => {
      const fileA = await createFile(
        'Multiple #same-tag mentions #same-tag here.'
      );

      const ws = createTestWorkspace().set(
        parser.parse(fileA.uri, fileA.content)
      );
      const graph = FoamGraph.fromWorkspace(ws);
      const tags = FoamTags.fromWorkspace(ws);

      const { doc } = await showInEditor(fileA.uri);
      const provider = new NavigationProvider(ws, graph, parser, tags);

      // Test references for #same-tag (clicking on first occurrence)
      const refs = await provider.provideReferences(
        doc,
        new vscode.Position(0, 10) // Position within first #same-tag
      );

      expect(refs.length).toEqual(2); // Both occurrences of #same-tag

      // Verify both ranges are correct
      const sortedRefs = refs.sort(
        (a, b) => a.range.start.character - b.range.start.character
      );

      // First occurrence: "Multiple #same-tag mentions"
      expect(sortedRefs[0].range.start.character).toBeLessThan(
        sortedRefs[1].range.start.character
      );
    });

    it('should not provide references when position is not on a tag', async () => {
      const fileA = await createFile('This file has #tag1 and normal text.');

      const ws = createTestWorkspace().set(
        parser.parse(fileA.uri, fileA.content)
      );
      const graph = FoamGraph.fromWorkspace(ws);
      const tags = FoamTags.fromWorkspace(ws);

      const { doc } = await showInEditor(fileA.uri);
      const provider = new NavigationProvider(ws, graph, parser, tags);

      // Position on "normal text" (not on a tag or link)
      const refs = await provider.provideReferences(
        doc,
        new vscode.Position(0, 30)
      );

      expect(refs).toBeUndefined();
    });

    it.todo('should provide references for placeholders');
  });
});
