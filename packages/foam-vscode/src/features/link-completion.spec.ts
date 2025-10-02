/* @unit-ready */

import * as vscode from 'vscode';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { FoamGraph } from '../core/model/graph';
import { createTestNote, createTestWorkspace } from '../test/test-utils';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  showInEditor,
  withModifiedFoamConfiguration,
} from '../test/test-utils-vscode';
import { fromVsCodeUri } from '../utils/vsc-utils';
import {
  WikilinkCompletionProvider,
  SectionCompletionProvider,
} from './link-completion';
import { CONVERT_WIKILINK_TO_MDLINK } from './commands/convert-links';

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
    const provider = new WikilinkCompletionProvider(ws, graph);

    const links = await provider.provideCompletionItems(
      doc,
      new vscode.Position(0, 0)
    );

    expect(links).toBeNull();
  });

  it('should not return link outside the wikilink brackets', async () => {
    const { uri } = await createFile('[[file]] then');
    const { doc } = await showInEditor(uri);
    const provider = new WikilinkCompletionProvider(ws, graph);

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
      const provider = new WikilinkCompletionProvider(ws, graph);

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

  it('should support label setting', async () => {
    const { uri: noteUri, content } = await createFile(`# My Note Title`);
    const workspace = createTestWorkspace();
    workspace.set(parser.parse(noteUri, content));
    const provider = new WikilinkCompletionProvider(
      workspace,
      FoamGraph.fromWorkspace(workspace)
    );

    const { uri } = await createFile('[[');
    const { doc } = await showInEditor(uri);

    await withModifiedFoamConfiguration(
      'completion.label',
      'title',
      async () => {
        const links = await provider.provideCompletionItems(
          doc,
          new vscode.Position(0, 3)
        );

        expect(links.items.map(i => i.label)).toEqual(['My Note Title']);
      }
    );

    await withModifiedFoamConfiguration(
      'completion.label',
      'path',
      async () => {
        const links = await provider.provideCompletionItems(
          doc,
          new vscode.Position(0, 3)
        );

        expect(links.items.map(i => i.label)).toEqual([noteUri.getBasename()]);
      }
    );

    await withModifiedFoamConfiguration(
      'completion.label',
      'identifier',
      async () => {
        const links = await provider.provideCompletionItems(
          doc,
          new vscode.Position(0, 3)
        );

        expect(links.items.map(i => i.label)).toEqual([
          workspace.getIdentifier(noteUri),
        ]);
      }
    );
  });

  it('should support alias setting', async () => {
    const { uri: noteUri, content } = await createFile(`# My Note Title`);
    const workspace = createTestWorkspace();
    workspace.set(parser.parse(noteUri, content));
    const provider = new WikilinkCompletionProvider(
      workspace,
      FoamGraph.fromWorkspace(workspace)
    );

    const { uri } = await createFile('[[');
    const { doc } = await showInEditor(uri);

    await withModifiedFoamConfiguration(
      'completion.useAlias',
      'never',
      async () => {
        const links = await provider.provideCompletionItems(
          doc,
          new vscode.Position(0, 3)
        );

        expect(links.items.map(i => i.insertText)).toEqual([
          workspace.getIdentifier(noteUri),
        ]);
      }
    );

    await withModifiedFoamConfiguration(
      'completion.useAlias',
      'whenPathDiffersFromTitle',
      async () => {
        const links = await provider.provideCompletionItems(
          doc,
          new vscode.Position(0, 3)
        );

        expect(links.items.map(i => i.insertText)).toEqual([
          `${workspace.getIdentifier(noteUri)}|My Note Title`,
        ]);
      }
    );
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

  it('should return page alias', async () => {
    const { uri, content } = await createFile(
      `
---
alias: alias-a
---
[[
`,
      ['new-note-with-alias.md']
    );
    ws.set(parser.parse(uri, content));

    const { doc } = await showInEditor(uri);
    const provider = new WikilinkCompletionProvider(ws, graph);

    const links = await provider.provideCompletionItems(
      doc,
      new vscode.Position(4, 2)
    );

    const aliasCompletionItem = links.items.find(i => i.label === 'alias-a');
    expect(aliasCompletionItem).not.toBeNull();
    expect(aliasCompletionItem.label).toBe('alias-a');
    expect(aliasCompletionItem.insertText).toBe('new-note-with-alias|alias-a');
  });

  it('should support linkFormat setting - wikilink format (default)', async () => {
    const { uri: noteUri, content } = await createFile(`# My Note Title`);
    const workspace = createTestWorkspace();
    workspace.set(parser.parse(noteUri, content));
    const provider = new WikilinkCompletionProvider(
      workspace,
      FoamGraph.fromWorkspace(workspace)
    );

    const { uri } = await createFile('[[');
    const { doc } = await showInEditor(uri);

    await withModifiedFoamConfiguration(
      'completion.linkFormat',
      'wikilink',
      async () => {
        await withModifiedFoamConfiguration(
          'completion.useAlias',
          'never',
          async () => {
            const links = await provider.provideCompletionItems(
              doc,
              new vscode.Position(0, 2)
            );

            expect(links.items.length).toBe(1);
            expect(links.items[0].insertText).toBe(
              workspace.getIdentifier(noteUri)
            );
          }
        );
      }
    );
  });

  it('should support linkFormat setting - markdown link format', async () => {
    const { uri: noteUri, content } = await createFile(`# My Note Title`, [
      'my',
      'path',
      'to',
      'test-note.md',
    ]);
    const workspace = createTestWorkspace();
    workspace.set(parser.parse(noteUri, content));
    const provider = new WikilinkCompletionProvider(
      workspace,
      FoamGraph.fromWorkspace(workspace)
    );

    const { uri } = await createFile('[[');
    const { doc } = await showInEditor(uri);

    await withModifiedFoamConfiguration(
      'completion.linkFormat',
      'link',
      async () => {
        const links = await provider.provideCompletionItems(
          doc,
          new vscode.Position(0, 2)
        );

        expect(links.items.length).toBe(1);
        const insertText = String(links.items[0].insertText);

        // In test environment, the command converts wikilink to markdown after insertion
        // The insertText is the wikilink format, conversion happens via command
        // So we expect just the identifier (no alias because linkFormat === 'link')
        expect(insertText).toBe(workspace.getIdentifier(noteUri));

        // Commit characters should be empty when using conversion command
        expect(links.items[0].commitCharacters).toEqual([]);

        // Verify command is attached for conversion
        expect(links.items[0].command).toBeDefined();
        expect(links.items[0].command.command).toBe(
          CONVERT_WIKILINK_TO_MDLINK.command
        );
      }
    );
  });

  it('should support linkFormat setting with aliases - markdown format', async () => {
    const { uri: noteUri, content } = await createFile(`# My Different Title`, [
      'another-note.md',
    ]);
    const workspace = createTestWorkspace();
    workspace.set(parser.parse(noteUri, content));
    const provider = new WikilinkCompletionProvider(
      workspace,
      FoamGraph.fromWorkspace(workspace)
    );

    const { uri } = await createFile('[[');
    const { doc } = await showInEditor(uri);

    await withModifiedFoamConfiguration(
      'completion.linkFormat',
      'link',
      async () => {
        await withModifiedFoamConfiguration(
          'completion.useAlias',
          'whenPathDiffersFromTitle',
          async () => {
            const links = await provider.provideCompletionItems(
              doc,
              new vscode.Position(0, 2)
            );

            expect(links.items.length).toBe(1);
            const insertText = links.items[0].insertText;

            // When linkFormat is 'link', we don't use alias in insertText
            // The conversion command handles the title mapping
            expect(insertText).toBe(workspace.getIdentifier(noteUri));
            expect(links.items[0].commitCharacters).toEqual([]);

            // Verify command is attached for conversion
            expect(links.items[0].command).toBeDefined();
            expect(links.items[0].command.command).toBe(
              CONVERT_WIKILINK_TO_MDLINK.command
            );
          }
        );
      }
    );
  });

  it('should handle alias completion with markdown link format', async () => {
    const { uri, content } = await createFile(
      `
---
alias: test-alias
---
[[
`,
      ['note-with-alias.md']
    );
    ws.set(parser.parse(uri, content));

    const { doc } = await showInEditor(uri);
    const provider = new WikilinkCompletionProvider(ws, graph);

    await withModifiedFoamConfiguration(
      'completion.linkFormat',
      'link',
      async () => {
        const links = await provider.provideCompletionItems(
          doc,
          new vscode.Position(4, 2)
        );

        const aliasCompletionItem = links.items.find(
          i => i.label === 'test-alias'
        );
        expect(aliasCompletionItem).not.toBeNull();
        expect(aliasCompletionItem.label).toBe('test-alias');

        // Alias completions always use pipe syntax in insertText
        // The conversion command will convert it to markdown format
        expect(aliasCompletionItem.insertText).toBe(
          'note-with-alias|test-alias'
        );
        expect(aliasCompletionItem.commitCharacters).toEqual([]);

        // Verify command is attached for conversion
        expect(aliasCompletionItem.command).toBeDefined();
        expect(aliasCompletionItem.command.command).toBe(
          CONVERT_WIKILINK_TO_MDLINK.command
        );
      }
    );
  });

  it('should ignore linkFormat setting for placeholder completions', async () => {
    const { uri } = await createFile('[[');
    const { doc } = await showInEditor(uri);
    const provider = new WikilinkCompletionProvider(ws, graph);

    // Test with wikilink format - should return plain text
    await withModifiedFoamConfiguration(
      'completion.linkFormat',
      'wikilink',
      async () => {
        const links = await provider.provideCompletionItems(
          doc,
          new vscode.Position(0, 2)
        );

        const placeholderItem = links.items.find(
          i => i.label === 'placeholder text'
        );
        expect(placeholderItem).not.toBeNull();
        expect(placeholderItem.insertText).toBe('placeholder text');
      }
    );

    // Test with markdown link format - should also return plain text (ignore format conversion)
    await withModifiedFoamConfiguration(
      'completion.linkFormat',
      'link',
      async () => {
        const links = await provider.provideCompletionItems(
          doc,
          new vscode.Position(0, 2)
        );

        const placeholderItem = links.items.find(
          i => i.label === 'placeholder text'
        );
        expect(placeholderItem).not.toBeNull();
        // Placeholders should remain as plain text, not converted to wikilink format
        expect(placeholderItem.insertText).toBe('placeholder text');
      }
    );
  });
});
