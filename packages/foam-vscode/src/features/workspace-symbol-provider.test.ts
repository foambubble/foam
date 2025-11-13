import { FoamWorkspaceSymbolProvider } from './workspace-symbol-provider';
import { FoamWorkspace } from '../core/model/workspace';
import { Resource } from '../core/model/note';
import { URI } from '../core/model/uri';
import { Range } from '../core/model/range';
import * as vscode from 'vscode';

describe('FoamWorkspaceSymbolProvider', () => {
  describe('matchesQuery', () => {
    it('should match empty query', () => {
      const provider = new FoamWorkspaceSymbolProvider(new FoamWorkspace());
      const result = provider.provideWorkspaceSymbols('');
      expect(result).toEqual([]);
    });

    it('should match subsequence in alias title', () => {
      const provider = new FoamWorkspaceSymbolProvider(new FoamWorkspace());
      expect(provider.matchesQuery('alt', 'alternative title')).toBe(true);
      expect(provider.matchesQuery('altit', 'alternative title')).toBe(true);
      expect(provider.matchesQuery('title', 'alternative title')).toBe(true);
      expect(provider.matchesQuery('tit', 'alternative title')).toBe(true);
    });

    it('should not match wrong order', () => {
      const provider = new FoamWorkspaceSymbolProvider(new FoamWorkspace());

      expect(provider.matchesQuery('title alt', 'alternative title')).toBe(
        false
      );
      expect(provider.matchesQuery('zyx', 'alternative title')).toBe(false);
    });

    it('should be case insensitive', () => {
      const provider = new FoamWorkspaceSymbolProvider(new FoamWorkspace());

      expect(provider.matchesQuery('ALT', 'alternative title')).toBe(true);
      expect(provider.matchesQuery('alt', 'ALTERNATIVE TITLE')).toBe(true);
      expect(provider.matchesQuery('AlT', 'Alternative Title')).toBe(true);
    });

    it('should match exact strings', () => {
      const provider = new FoamWorkspaceSymbolProvider(new FoamWorkspace());

      expect(
        provider.matchesQuery('alternative title', 'alternative title')
      ).toBe(true);
      expect(provider.matchesQuery('', 'alternative title')).toBe(true);
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
        tags: [],
        aliases: [
          {
            title: 'different alias',
            range: Range.create(0, 0, 0, 10),
          },
        ],
        links: [],
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
        tags: [],
        aliases: [
          {
            title: 'alternative one',
            range: aliasRange,
          },
        ],
        links: [],
      };

      const resource2: Resource = {
        uri: URI.file('/note2.md'),
        type: 'note',
        title: 'Note 2',
        properties: {},
        sections: [],
        tags: [],
        aliases: [
          {
            title: 'alternative two',
            range: aliasRange,
          },
        ],
        links: [],
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
        tags: [],
        aliases: [
          {
            title: 'test alias',
            range: aliasRange,
          },
        ],
        links: [],
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
