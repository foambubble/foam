import {
  convertWikilinkToMarkdownAtPosition,
  convertMarkdownToWikilinkAtPosition,
} from './convert-links';
import { URI } from '../../core/model/uri';
import { Position } from '../../core/model/position';
import { Range } from '../../core/model/range';
import { TextEdit } from '../../core/services/text-edit';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { createMarkdownParser } from '../../core/services/markdown-parser';

describe('Link Conversion Functions', () => {
  describe('convertWikilinkToMarkdownAtPosition', () => {
    it('should convert simple wikilink to markdown link', () => {
      const documentText = 'Text before [[note-a]] text after';
      const documentUri = URI.file('/test/current.md');
      const linkPosition: Position = { line: 0, character: 15 }; // Inside [[note-a]]

      const workspace = createTestWorkspace().set(
        createTestNote({ uri: '/test/note-a.md', title: 'Note A' })
      );
      const parser = createMarkdownParser();

      const result = convertWikilinkToMarkdownAtPosition(
        documentText,
        documentUri,
        linkPosition,
        workspace,
        parser
      );

      expect(result).not.toBeNull();
      expect(result!.newText).toBe('[Note A](note-a.md)');
      expect(result!.range).toEqual(Range.create(0, 12, 0, 22));

      // Check the final result after applying the edit
      const finalText = TextEdit.apply(documentText, result!);
      expect(finalText).toBe('Text before [Note A](note-a.md) text after');
    });

    it('should convert wikilink with alias to markdown link', () => {
      const documentText = 'Text before [[note-a|Custom Title]] text after';
      const documentUri = URI.file('/test/current.md');
      const linkPosition: Position = { line: 0, character: 15 };

      const workspace = createTestWorkspace().set(
        createTestNote({ uri: '/test/note-a.md', title: 'Note A' })
      );
      const parser = createMarkdownParser();

      const result = convertWikilinkToMarkdownAtPosition(
        documentText,
        documentUri,
        linkPosition,
        workspace,
        parser
      );

      expect(result).not.toBeNull();
      expect(result!.newText).toBe('[Custom Title](note-a.md)');

      // Check the final result after applying the edit
      const finalText = TextEdit.apply(documentText, result!);
      expect(finalText).toBe(
        'Text before [Custom Title](note-a.md) text after'
      );
    });

    it('should handle subfolders paths correctly', () => {
      const documentText = 'Text before [[path/to/note-b]] text after';
      const documentUri = URI.file('/test/current.md');
      const linkPosition: Position = { line: 0, character: 20 };

      const workspace = createTestWorkspace().set(
        createTestNote({ uri: '/test/path/to/note-b.md', title: 'Note B' })
      );
      const parser = createMarkdownParser();

      const result = convertWikilinkToMarkdownAtPosition(
        documentText,
        documentUri,
        linkPosition,
        workspace,
        parser
      );

      expect(result).not.toBeNull();
      expect(result!.newText).toBe('[Note B](path/to/note-b.md)');

      // Check the final result after applying the edit
      const finalText = TextEdit.apply(documentText, result!);
      expect(finalText).toBe(
        'Text before [Note B](path/to/note-b.md) text after'
      );
    });

    it('should handle relative paths correctly', () => {
      const documentText = 'Text before [[note-b]] text after';
      const documentUri = URI.file('/test/sub1/current.md');
      const linkPosition: Position = { line: 0, character: 20 };

      const workspace = createTestWorkspace().set(
        createTestNote({ uri: '/test/sub2/note-b.md', title: 'Note B' })
      );
      const parser = createMarkdownParser();

      const result = convertWikilinkToMarkdownAtPosition(
        documentText,
        documentUri,
        linkPosition,
        workspace,
        parser
      );

      expect(result).not.toBeNull();
      expect(result!.newText).toBe('[Note B](../sub2/note-b.md)');

      // Check the final result after applying the edit
      const finalText = TextEdit.apply(documentText, result!);
      expect(finalText).toBe(
        'Text before [Note B](../sub2/note-b.md) text after'
      );
    });

    it('should return null when no wikilink at cursor position', () => {
      const documentText = 'Text with no wikilink at cursor';
      const documentUri = URI.file('/test/current.md');
      const linkPosition: Position = { line: 0, character: 5 };

      const workspace = createTestWorkspace();
      const parser = createMarkdownParser();

      const result = convertWikilinkToMarkdownAtPosition(
        documentText,
        documentUri,
        linkPosition,
        workspace,
        parser
      );

      expect(result).toBeNull();
    });

    it('should throw error when target resource not found', () => {
      const documentText = 'Text before [[nonexistent]] text after';
      const documentUri = URI.file('/test/current.md');
      const linkPosition: Position = { line: 0, character: 15 };

      const workspace = createTestWorkspace(); // Empty workspace
      const parser = createMarkdownParser();

      expect(() => {
        convertWikilinkToMarkdownAtPosition(
          documentText,
          documentUri,
          linkPosition,
          workspace,
          parser
        );
      }).toThrow('Resource "nonexistent" not found');
    });
  });

  describe('convertMarkdownToWikilinkAtPosition', () => {
    it('should convert simple markdown link to wikilink', () => {
      const documentText = 'Text before [Note A](note-a.md) text after';
      const documentUri = URI.file('/test/current.md');
      const linkPosition: Position = { line: 0, character: 15 };

      const workspace = createTestWorkspace().set(
        createTestNote({ uri: '/test/note-a.md', title: 'Note A' })
      );
      const parser = createMarkdownParser();

      const result = convertMarkdownToWikilinkAtPosition(
        documentText,
        documentUri,
        linkPosition,
        {
          resolveLink: workspace.resolveLink,
          get: workspace.get,
          getIdentifier: workspace.getTrieIdentifier().getIdentifier,
        },
        parser
      );

      expect(result).not.toBeNull();
      expect(result!.newText).toBe('[[note-a]]');
      expect(result!.range).toEqual(Range.create(0, 12, 0, 31));
    });

    it('should convert simple markdown link to other folder to wikilink', () => {
      const documentText = 'Text before [Note A](docs/note-a.md) text after';
      const documentUri = URI.file('/test/current.md');
      const linkPosition: Position = { line: 0, character: 15 };

      const workspace = createTestWorkspace().set(
        createTestNote({ uri: '/test/docs/note-a.md', title: 'Note A' })
      );
      const parser = createMarkdownParser();

      const result = convertMarkdownToWikilinkAtPosition(
        documentText,
        documentUri,
        linkPosition,
        {
          resolveLink: workspace.resolveLink,
          get: workspace.get,
          getIdentifier: workspace.getTrieIdentifier().getIdentifier,
        },
        parser
      );

      expect(result).not.toBeNull();
      expect(result!.newText).toBe('[[note-a]]');
      expect(result!.range).toEqual(Range.create(0, 12, 0, 36));
    });

    it('should preserve alias when different from title', () => {
      const documentText = 'Text before [Custom Title](note-a.md) text after';
      const documentUri = URI.file('/test/current.md');
      const linkPosition: Position = { line: 0, character: 15 };

      const workspace = createTestWorkspace().set(
        createTestNote({ uri: '/test/note-a.md', title: 'Note A' })
      );
      const parser = createMarkdownParser();

      const result = convertMarkdownToWikilinkAtPosition(
        documentText,
        documentUri,
        linkPosition,
        {
          resolveLink: workspace.resolveLink,
          get: workspace.get,
          getIdentifier: workspace.getTrieIdentifier().getIdentifier,
        },
        parser
      );

      expect(result).not.toBeNull();
      expect(result!.newText).toBe('[[note-a|Custom Title]]');
    });

    it('should return null when no markdown link at cursor position', () => {
      const documentText = 'Text with no markdown link at cursor';
      const documentUri = URI.file('/test/current.md');
      const linkPosition: Position = { line: 0, character: 5 };

      const workspace = createTestWorkspace();
      const parser = createMarkdownParser();

      const result = convertMarkdownToWikilinkAtPosition(
        documentText,
        documentUri,
        linkPosition,
        {
          resolveLink: workspace.resolveLink,
          get: workspace.get,
          getIdentifier: workspace.getTrieIdentifier().getIdentifier,
        },
        parser
      );

      expect(result).toBeNull();
    });

    it('should throw error when target resource not found', () => {
      const documentText = 'Text before [Link](nonexistent.md) text after';
      const documentUri = URI.file('/test/current.md');
      const linkPosition: Position = { line: 0, character: 15 };

      const workspace = createTestWorkspace();
      const parser = createMarkdownParser();

      expect(() => {
        convertMarkdownToWikilinkAtPosition(
          documentText,
          documentUri,
          linkPosition,
          {
            resolveLink: workspace.resolveLink,
            get: workspace.get,
            getIdentifier: workspace.getTrieIdentifier().getIdentifier,
          },
          parser
        );
      }).toThrow('Resource not found: /test/nonexistent.md');
    });
  });
});
