/* @unit-ready */

import * as vscode from 'vscode';
import { FoamWorkspaceSymbolProvider } from './workspace-symbol-provider';
import { createTestNote, createTestWorkspace } from '../test/test-utils';

describe('FoamWorkspaceSymbolProvider Integration', () => {
  let provider: FoamWorkspaceSymbolProvider;
  let workspace: any;

  beforeEach(async () => {
    workspace = createTestWorkspace();
    provider = new FoamWorkspaceSymbolProvider(workspace);
  });

  it('should integrate with VS Code workspace symbol search', async () => {
    // Create test notes with aliases
    const note1 = createTestNote({
      uri: '/test1.md',
      aliases: ['first alternative'],
    });

    const note2 = createTestNote({
      uri: '/test2.md',
      aliases: ['second alternative'],
    });

    workspace.set(note1);
    workspace.set(note2);

    // Test the provider directly (simulating VS Code's call)
    const symbols = provider.provideWorkspaceSymbols('alt');

    expect(symbols).toHaveLength(2);

    const symbolNames = symbols.map(s => s.name);
    expect(symbolNames).toContain('first alternative');
    expect(symbolNames).toContain('second alternative');

    // Verify symbol properties match VS Code expectations
    symbols.forEach(symbol => {
      expect(symbol).toBeInstanceOf(vscode.SymbolInformation);
      expect(symbol.kind).toBe(vscode.SymbolKind.String);
      expect(symbol.location).toBeInstanceOf(vscode.Location);
      expect(symbol.location.uri).toBeDefined();
      expect(symbol.location.range).toBeInstanceOf(vscode.Range);
    });
  });

  it('should handle real-world alias formats from frontmatter', async () => {
    // Test with array format aliases
    const noteWithArrayAliases = createTestNote({
      uri: '/array-aliases.md',
      aliases: ['alias one', 'alias two'],
    });

    // Test with comma-separated format aliases
    const noteWithCommaSeparated = createTestNote({
      uri: '/comma-aliases.md',
      aliases: ['first, second, third'],
    });

    workspace.set(noteWithArrayAliases);
    workspace.set(noteWithCommaSeparated);

    // Test searching for different parts
    const aliasOneResults = provider.provideWorkspaceSymbols('one');
    expect(aliasOneResults).toHaveLength(1);
    expect(aliasOneResults[0].name).toBe('alias one');

    const commaResults = provider.provideWorkspaceSymbols('first');
    expect(commaResults).toHaveLength(1);
    expect(commaResults[0].name).toBe('first, second, third');
  });

  it('should provide location information for navigation', async () => {
    const note = createTestNote({
      uri: '/location-test.md',
      aliases: ['test alias'],
    });

    workspace.set(note);

    const symbols = provider.provideWorkspaceSymbols('test');
    expect(symbols).toHaveLength(1);

    const symbol = symbols[0];
    // The createTestNote function uses default ranges for aliases
    expect(symbol.location.range).toBeInstanceOf(vscode.Range);
    expect(symbol.containerName).toBe('location-test.md');
  });

  it('should handle large workspace with many aliases efficiently (so we do not need to cache)', async () => {
    // Create many notes with aliases to test performance
    for (let i = 0; i < 10000; i++) {
      const note = createTestNote({
        uri: `/note${i}.md`,
        aliases: [`alias number ${i}`, `alternative ${i}`],
      });
      workspace.set(note);
    }

    // Performance test - should complete quickly as we have decided not to cache
    const start = Date.now();
    const symbols = provider.provideWorkspaceSymbols('alternative');
    const end = Date.now();

    expect(symbols).toHaveLength(10000);
    expect(end - start).toBeLessThan(500); // Should complete in under 500ms
  });

  it('should not interfere with existing markdown symbols', async () => {
    // This test verifies that our provider complements VS Code's built-in markdown symbols
    // rather than replacing them. We can't directly test VS Code's built-in provider,
    // but we can ensure our provider only returns aliases.

    const note = createTestNote({
      uri: '/mixed-content.md',
      title: 'Main Title',
      aliases: ['only alias here'],
      sections: ['Section Heading'],
    });

    workspace.set(note);

    // Our provider should only return aliases, not sections or titles
    const symbols = provider.provideWorkspaceSymbols('');
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe('only alias here');
    expect(symbols[0].kind).toBe(vscode.SymbolKind.String);

    // Should not return sections (those are handled by VS Code's markdown provider)
    expect(symbols.find(s => s.name === 'Section Heading')).toBeUndefined();
    expect(symbols.find(s => s.name === 'Main Title')).toBeUndefined();
  });
});
