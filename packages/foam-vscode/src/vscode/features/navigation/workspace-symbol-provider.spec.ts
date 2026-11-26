/* @unit-ready */

import * as vscode from 'vscode';
import { FoamWorkspaceSymbolProvider } from './workspace-symbol-provider';
import { createTestNote, createTestWorkspace } from '../../../test/test-utils';
import { FoamWorkspace, Range, Resource, URI } from '@foam/core';

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

  describe('matching aliases against the query', () => {
    const matchingAliases = (alias: string, query: string) => {
      const workspace = createTestWorkspace();
      workspace.set(createTestNote({ uri: '/note.md', aliases: [alias] }));
      return new FoamWorkspaceSymbolProvider(workspace)
        .provideWorkspaceSymbols(query)
        .map(symbol => symbol.name);
    };

    it('should match empty query', () => {
      const provider = new FoamWorkspaceSymbolProvider(new FoamWorkspace());
      const result = provider.provideWorkspaceSymbols('');
      expect(result).toEqual([]);
    });

    it('should match subsequence in alias title', () => {
      for (const query of ['alt', 'altit', 'title', 'tit']) {
        expect(matchingAliases('alternative title', query)).toEqual([
          'alternative title',
        ]);
      }
    });

    it('should not match wrong order', () => {
      expect(matchingAliases('alternative title', 'title alt')).toEqual([]);
      expect(matchingAliases('alternative title', 'zyx')).toEqual([]);
    });

    it('should be case insensitive', () => {
      expect(matchingAliases('alternative title', 'ALT')).toEqual([
        'alternative title',
      ]);
      expect(matchingAliases('ALTERNATIVE TITLE', 'alt')).toEqual([
        'ALTERNATIVE TITLE',
      ]);
      expect(matchingAliases('Alternative Title', 'AlT')).toEqual([
        'Alternative Title',
      ]);
    });

    it('should match exact strings', () => {
      expect(matchingAliases('alternative title', 'alternative title')).toEqual(
        ['alternative title']
      );
      expect(matchingAliases('alternative title', '')).toEqual([
        'alternative title',
      ]);
    });
  });

  describe('provideWorkspaceSymbols', () => {
    it('should return empty array when workspace is empty', () => {
      const provider = new FoamWorkspaceSymbolProvider(new FoamWorkspace());

      const result = provider.provideWorkspaceSymbols('test');
      expect(result).toEqual([]);
    });

    it('should return empty array when no aliases match', () => {
      const workspace = new FoamWorkspace();
      const provider = new FoamWorkspaceSymbolProvider(workspace);

      const resource: Resource = {
        uri: URI.file('/test.md'),
        type: 'note',
        title: 'Test Note',
        properties: {},
        sections: [],
        blocks: [],
        tags: [],
        aliases: [
          {
            title: 'different alias',
            range: Range.create(0, 0, 0, 10),
          },
        ],
        links: [],
        footnotes: [],
        tasks: [],
      };
      workspace.set(resource);

      const result = provider.provideWorkspaceSymbols('notfound');
      expect(result).toEqual([]);
    });

    it('should return matching aliases from single resource', () => {
      const workspace = new FoamWorkspace();
      const provider = new FoamWorkspaceSymbolProvider(workspace);

      const aliasRange = Range.create(2, 0, 2, 20);
      const resource: Resource = {
        uri: URI.file('/test.md'),
        type: 'note',
        title: 'Test Note',
        properties: {},
        sections: [],
        blocks: [],
        tags: [],
        aliases: [
          {
            title: 'alternative title',
            range: aliasRange,
          },
          {
            title: 'another name',
            range: aliasRange,
          },
        ],
        links: [],
        footnotes: [],
        tasks: [],
      };
      workspace.set(resource);

      const result = provider.provideWorkspaceSymbols('alt');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('alternative title');
      expect(result[0].kind).toBe(vscode.SymbolKind.String);
      expect(result[0].containerName).toBe('test.md');
    });

    it('should return matching aliases from multiple resources', () => {
      const workspace = new FoamWorkspace();
      const provider = new FoamWorkspaceSymbolProvider(workspace);

      const aliasRange = Range.create(2, 0, 2, 20);

      const resource1: Resource = {
        uri: URI.file('/note1.md'),
        type: 'note',
        title: 'Note 1',
        properties: {},
        sections: [],
        blocks: [],
        tags: [],
        aliases: [
          {
            title: 'alternative one',
            range: aliasRange,
          },
        ],
        links: [],
        footnotes: [],
        tasks: [],
      };

      const resource2: Resource = {
        uri: URI.file('/note2.md'),
        type: 'note',
        title: 'Note 2',
        properties: {},
        sections: [],
        blocks: [],
        tags: [],
        aliases: [
          {
            title: 'alternative two',
            range: aliasRange,
          },
        ],
        links: [],
        footnotes: [],
        tasks: [],
      };

      workspace.set(resource1);
      workspace.set(resource2);

      const result = provider.provideWorkspaceSymbols('alt');
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name)).toContain('alternative one');
      expect(result.map(s => s.name)).toContain('alternative two');
      expect(result.map(s => s.containerName)).toContain('note1.md');
      expect(result.map(s => s.containerName)).toContain('note2.md');
    });

    it('should return all aliases when query is empty', () => {
      const workspace = new FoamWorkspace();
      const provider = new FoamWorkspaceSymbolProvider(workspace);

      const aliasRange = Range.create(2, 0, 2, 20);
      const resource: Resource = {
        uri: URI.file('/test.md'),
        type: 'note',
        title: 'Test Note',
        properties: {},
        sections: [],
        blocks: [],
        tags: [],
        aliases: [
          {
            title: 'first alias',
            range: aliasRange,
          },
          {
            title: 'second alias',
            range: aliasRange,
          },
        ],
        links: [],
        footnotes: [],
        tasks: [],
      };
      workspace.set(resource);

      const result = provider.provideWorkspaceSymbols('');
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name)).toContain('first alias');
      expect(result.map(s => s.name)).toContain('second alias');
    });

    it('should create SymbolInformation with correct properties', () => {
      const workspace = new FoamWorkspace();
      const provider = new FoamWorkspaceSymbolProvider(workspace);

      const aliasRange = Range.create(2, 5, 2, 25);
      const resource: Resource = {
        uri: URI.file('/path/to/note.md'),
        type: 'note',
        title: 'Test Note',
        properties: {},
        sections: [],
        blocks: [],
        tags: [],
        aliases: [
          {
            title: 'test alias',
            range: aliasRange,
          },
        ],
        links: [],
        footnotes: [],
        tasks: [],
      };
      workspace.set(resource);

      const result = provider.provideWorkspaceSymbols('test');
      expect(result).toHaveLength(1);

      const symbol = result[0];
      expect(symbol.name).toBe('test alias');
      expect(symbol.kind).toBe(vscode.SymbolKind.String);
      expect(symbol.containerName).toBe('note.md');
      expect(symbol.location.uri.toString()).toContain('/path/to/note.md');
      expect(symbol.location.range.start.line).toBe(2);
      expect(symbol.location.range.start.character).toBe(5);
      expect(symbol.location.range.end.line).toBe(2);
      expect(symbol.location.range.end.character).toBe(25);
    });
  });
});
