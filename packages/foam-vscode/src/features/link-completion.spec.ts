import * as vscode from 'vscode';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { FoamGraph } from '../core/model/graph';
import { createTestNote, createTestWorkspace } from '../test/test-utils';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
} from '../test/test-utils-vscode';
import { fromVsCodeUri } from '../utils/vsc-utils';
import {
  CompletionProvider,
  SectionCompletionProvider,
} from './link-completion';

describe('Link Completion', () => {
  const parser = createMarkdownParser([]);
  const root = fromVsCodeUri(vscode.workspace.workspaceFolders[0].uri);
  const ws = createTestWorkspace();
  ws.set(
    createTestNote({
      root,
      uri: 'file-name.md',
      sections: ['Section One', 'Section Two'],
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
    )
    .set(
      createTestNote({
        root,
        uri: 'another/file.md',
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

  it('should not return link outside the wikilink brackets', async () => {
    const { uri } = await createFile('[[file]] then');
    const { doc } = await showInEditor(uri);
    const provider = new CompletionProvider(ws, graph);

    const links = await provider.provideCompletionItems(
      doc,
      new vscode.Position(0, 12)
    );

    expect(links).toBeNull();
  });

  it('should return notes with unique identifiers, and placeholders', async () => {
    for (const text of ['[[', '[[file]] [[', '[[file]] #tag [[']) {
      const { uri } = await createFile(text);
      const { doc } = await showInEditor(uri);
      const provider = new CompletionProvider(ws, graph);

      const links = await provider.provideCompletionItems(
        doc,
        new vscode.Position(0, text.length)
      );

      expect(links.items.length).toEqual(5);
      expect(new Set(links.items.map(i => i.insertText))).toEqual(
        new Set([
          'to/file',
          'another/file',
          'File name with spaces',
          'file-name',
          'placeholder text',
        ])
      );
    }
  });

  it('should return sections for other notes', async () => {
    for (const text of [
      '[[file-name#',
      '[[file]] [[file-name#',
      '[[file]] #tag [[file-name#',
    ]) {
      const { uri } = await createFile(text);
      const { doc } = await showInEditor(uri);
      const provider = new SectionCompletionProvider(ws);

      const links = await provider.provideCompletionItems(
        doc,
        new vscode.Position(0, text.length)
      );

      expect(new Set(links.items.map(i => i.label))).toEqual(
        new Set(['Section One', 'Section Two'])
      );
    }
  });

  it('should return sections within the note', async () => {
    const { uri, content } = await createFile(`
# Section 1

Content of section 1

# Section 2

Content of section 2

[[#
`);
    ws.set(parser.parse(uri, content));

    const { doc } = await showInEditor(uri);
    const provider = new SectionCompletionProvider(ws);

    const links = await provider.provideCompletionItems(
      doc,
      new vscode.Position(9, 3)
    );

    expect(new Set(links.items.map(i => i.label))).toEqual(
      new Set(['Section 1', 'Section 2'])
    );
  });
});
