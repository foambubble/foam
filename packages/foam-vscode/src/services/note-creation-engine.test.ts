import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';
import { NoteCreationEngine } from './note-creation-engine';
import { TriggerFactory } from './note-creation-triggers';
import {
  Template,
  isCommandTrigger,
  isPlaceholderTrigger,
} from './note-creation-types';
import { readFileFromFs, strToUri } from '../test/test-utils';
import { bootstrap } from '../core/model/foam';
import { FileDataStore, Matcher } from '../test/test-datastore';
import { MarkdownResourceProvider } from '../core/services/markdown-provider';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { Logger } from '../core/utils/log';
import { Resolver } from './variable-resolver';
import { URI } from '../core/model/uri';

Logger.setLevel('off');

async function setupFoamEngine() {
  // Set up Foam workspace (minimal setup for testing)
  const tmpDir = mkdtempSync(`${tmpdir()}/foam-test-`);
  const dataStore = new FileDataStore(readFileFromFs, tmpDir);
  const matcher = new Matcher([strToUri(tmpDir)], ['**/*.md']);
  const parser = createMarkdownParser();
  const provider = new MarkdownResourceProvider(dataStore, parser, ['.md']);
  const foam = await bootstrap(matcher, undefined, dataStore, parser, [
    provider,
  ]);
  const engine = new NoteCreationEngine(foam, [strToUri(tmpDir)]);
  return { foam, engine };
}

describe('NoteCreationEngine', () => {
  describe('processTemplate', () => {
    it('should process markdown templates correctly', async () => {
      const { engine } = await setupFoamEngine();
      // Create markdown template
      const template: Template = {
        type: 'markdown',
        content: `---
filepath: test-note.md
---
# \${FOAM_TITLE}

Test content with title: \${FOAM_TITLE}`,
        metadata: new Map([['filepath', 'test-note.md']]),
      };

      // Create trigger
      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      // Create resolver with variables
      const resolver = new Resolver(new Map(), new Date());
      resolver.define('FOAM_TITLE', 'Test Note');

      // Test processing
      const result = await engine.processTemplate(trigger, template, resolver);

      expect(result.filepath.path).toBe('test-note.md');
      expect(result.content).toContain('# Test Note');
      expect(result.content).toContain('Test content with title: Test Note');
    });

    it('should handle command triggers with date parameters', async () => {
      const { engine } = await setupFoamEngine();
      // Create markdown template with date variables
      const template: Template = {
        type: 'markdown',
        metadata: new Map(),
        content: `# Daily Note \${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}

Today is \${FOAM_DATE_DAY_NAME}`,
      };

      // Create context with date trigger
      const testDate = new Date('2024-01-15');
      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.open-daily-note',
        {
          date: testDate,
        }
      );

      // Create resolver with date variables
      const resolver = new Resolver(new Map(), testDate);
      resolver.define('FOAM_TITLE', '2024-01-15');
      resolver.define('FOAM_DATE_YEAR', '2024');
      resolver.define('FOAM_DATE_MONTH', '01');
      resolver.define('FOAM_DATE_DATE', '15');
      resolver.define('FOAM_DATE_DAY_NAME', 'Monday');

      // Test processing with date variables
      const result = await engine.processTemplate(trigger, template, resolver);

      expect(result.content).toContain('Daily Note 2024-01-15');
      expect(result.content).toContain('Today is Monday');

      // Verify trigger type handling
      expect(trigger.type).toBe('command');
      if (!isCommandTrigger(trigger)) {
        throw new Error('Expected command trigger type');
      }
      expect(trigger.command).toBe('foam-vscode.open-daily-note');
      expect(trigger.params).toHaveProperty('date');
    });

    it('should handle placeholder triggers correctly', async () => {
      const { engine } = await setupFoamEngine();
      // Create markdown template
      const template: Template = {
        type: 'markdown',
        metadata: new Map(),
        content: `# \${FOAM_TITLE}

Created from placeholder link.

Content goes here.`,
      };

      // Create placeholder trigger
      const trigger = TriggerFactory.createPlaceholderTrigger(
        strToUri('/test/source.md'),
        'Source Note',
        {
          uri: strToUri('/test/source.md'),
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 },
          },
          data: { rawText: '[[Test Note]]' },
        } as any
      );

      // Create resolver with variables
      const resolver = new Resolver(new Map(), new Date());
      resolver.define('FOAM_TITLE', 'Test Note');

      // Test processing
      const result = await engine.processTemplate(trigger, template, resolver);

      expect(result.content).toContain('# Test Note');
      expect(result.content).toContain('Created from placeholder link');

      // Verify trigger type handling
      expect(trigger.type).toBe('placeholder');
      if (!isPlaceholderTrigger(trigger)) {
        throw new Error('Expected placeholder trigger type');
      }
      expect(trigger.sourceNote.title).toBe('Source Note');
      expect(trigger.sourceNote.uri).toBe(
        strToUri('/test/source.md').toString()
      );
    });

    it('should generate default filepath when not specified in template', async () => {
      const { engine } = await setupFoamEngine();
      // Create markdown template without filepath metadata
      const template: Template = {
        type: 'markdown',
        metadata: new Map(),
        content: `# \${FOAM_TITLE}

Content without filepath metadata.`,
      };

      // Create resolver with variables
      const resolver = new Resolver(new Map(), new Date());
      resolver.define('FOAM_TITLE', 'My New Note');
      resolver.define('title', 'My New Note');

      // Test processing
      const result = await engine.processTemplate(
        TriggerFactory.createCommandTrigger('foam-vscode.create-note'),
        template,
        resolver
      );

      expect(result.content).toContain('# My New Note');
      expect(result.filepath.path).toBe('My New Note.md'); // Should generate from title
    });

    it('should handle JavaScript templates correctly', async () => {
      const { engine } = await setupFoamEngine();
      // Create JavaScript template
      const template: Template = {
        type: 'javascript',
        createNote: async context => {
          const title =
            (await context.resolver.resolveFromName('FOAM_TITLE')) ||
            'Untitled';
          const content = `# ${title}\n\nGenerated by JavaScript template\n\nTrigger: ${context.trigger.type}`;
          return {
            filepath: URI.parse(
              `${title.replace(/\s+/g, '-').toLowerCase()}.md`,
              'file'
            ),
            content,
          };
        },
      };

      // Create resolver with variables
      const resolver = new Resolver(new Map(), new Date());
      resolver.define('FOAM_TITLE', 'JS Generated Note');
      resolver.define('title', 'JS Generated Note');

      // Test processing
      const result = await engine.processTemplate(
        TriggerFactory.createCommandTrigger('foam-vscode.create-note'),
        template,
        resolver
      );

      expect(result.content).toContain('# JS Generated Note');
      expect(result.content).toContain('Generated by JavaScript template');
      expect(result.content).toContain('Trigger: command');
      expect(result.filepath.path).toBe('js-generated-note.md');
    });
  });

  describe('JavaScript template error handling', () => {
    it('should handle synchronous errors thrown by JavaScript templates', async () => {
      const { engine } = await setupFoamEngine();

      // Create JavaScript template that throws synchronously
      const template: Template = {
        type: 'javascript',
        createNote: () => {
          throw new Error('Template execution failed');
        },
      };

      const resolver = new Resolver(new Map(), new Date());
      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      // Test that error is properly caught and handled
      await expect(
        engine.processTemplate(trigger, template, resolver)
      ).rejects.toThrow('Template execution failed');
    });

    it('should handle asynchronous errors thrown by JavaScript templates', async () => {
      const { engine } = await setupFoamEngine();

      // Create JavaScript template that throws asynchronously
      const template: Template = {
        type: 'javascript',
        createNote: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('Async template execution failed');
        },
      };

      const resolver = new Resolver(new Map(), new Date());
      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      // Test that async error is properly caught and handled
      await expect(
        engine.processTemplate(trigger, template, resolver)
      ).rejects.toThrow('Async template execution failed');
    });

    it('should handle JavaScript templates returning null/undefined', async () => {
      const { engine } = await setupFoamEngine();

      // Create JavaScript template that returns null
      const nullTemplate: Template = {
        type: 'javascript',
        createNote: () => null as any,
      };

      const resolver = new Resolver(new Map(), new Date());
      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      // Test that null return is handled
      await expect(
        engine.processTemplate(trigger, nullTemplate, resolver)
      ).rejects.toThrow();

      // Create JavaScript template that returns undefined
      const undefinedTemplate: Template = {
        type: 'javascript',
        createNote: () => undefined as any,
      };

      // Test that undefined return is handled
      await expect(
        engine.processTemplate(trigger, undefinedTemplate, resolver)
      ).rejects.toThrow();
    });

    it('should handle JavaScript templates returning invalid data structures', async () => {
      const { engine } = await setupFoamEngine();

      // Create JavaScript template that returns object with missing filepath
      const missingFilepathTemplate: Template = {
        type: 'javascript',
        createNote: () =>
          ({
            content: 'Valid content',
            // Missing filepath
          } as any),
      };

      const resolver = new Resolver(new Map(), new Date());
      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      // Test that missing filepath is handled
      await expect(
        engine.processTemplate(trigger, missingFilepathTemplate, resolver)
      ).rejects.toThrow();

      // Create JavaScript template that returns object with missing content
      const missingContentTemplate: Template = {
        type: 'javascript',
        createNote: () =>
          ({
            filepath: 'valid-path.md',
            // Missing content
          } as any),
      };

      // Test that missing content is handled
      await expect(
        engine.processTemplate(trigger, missingContentTemplate, resolver)
      ).rejects.toThrow();

      // Create JavaScript template that returns wrong data types
      const wrongTypesTemplate: Template = {
        type: 'javascript',
        createNote: () =>
          ({
            filepath: 123, // Should be string
            content: true, // Should be string
          } as any),
      };

      // Test that wrong data types are handled
      await expect(
        engine.processTemplate(trigger, wrongTypesTemplate, resolver)
      ).rejects.toThrow();
    });

    it('should handle JavaScript templates with rejected promises', async () => {
      const { engine } = await setupFoamEngine();

      // Create JavaScript template that returns rejected promise
      const rejectedPromiseTemplate: Template = {
        type: 'javascript',
        createNote: () => Promise.reject(new Error('Promise rejected')),
      };

      const resolver = new Resolver(new Map(), new Date());
      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      // Test that rejected promise is handled
      await expect(
        engine.processTemplate(trigger, rejectedPromiseTemplate, resolver)
      ).rejects.toThrow('Promise rejected');
    });

    it('should handle JavaScript templates with mixed sync/async errors', async () => {
      const { engine } = await setupFoamEngine();

      // Create JavaScript template that sometimes throws sync, sometimes async
      let callCount = 0;
      const mixedErrorTemplate: Template = {
        type: 'javascript',
        createNote: () => {
          callCount++;
          if (callCount % 2 === 0) {
            throw new Error('Sync error');
          } else {
            return Promise.reject(new Error('Async error'));
          }
        },
      };

      const resolver = new Resolver(new Map(), new Date());
      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      // Test first call (async error)
      await expect(
        engine.processTemplate(trigger, mixedErrorTemplate, resolver)
      ).rejects.toThrow('Async error');

      // Test second call (sync error)
      await expect(
        engine.processTemplate(trigger, mixedErrorTemplate, resolver)
      ).rejects.toThrow('Sync error');
    });

    it('should handle JavaScript templates that return promises resolving to invalid data', async () => {
      const { engine } = await setupFoamEngine();

      // Create JavaScript template that returns promise resolving to invalid data
      const invalidPromiseTemplate: Template = {
        type: 'javascript',
        createNote: () =>
          Promise.resolve({
            filepath: null,
            content: null,
          } as any),
      };

      const resolver = new Resolver(new Map(), new Date());
      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      // Test that invalid promise resolution is handled
      await expect(
        engine.processTemplate(trigger, invalidPromiseTemplate, resolver)
      ).rejects.toThrow();
    });
  });

  describe('trigger validation', () => {
    it('should validate command triggers', () => {
      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.open-daily-note',
        { date: new Date() }
      );

      expect(trigger.type).toBe('command');
      if (!isCommandTrigger(trigger)) {
        throw new Error('Expected command trigger type');
      }
      expect(trigger.command).toBe('foam-vscode.open-daily-note');
      expect(trigger.params).toHaveProperty('date');
    });

    it('should validate placeholder triggers', () => {
      const sourceUri = strToUri('/test/source.md');
      const mockLocation = {
        uri: sourceUri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 10 },
        },
        data: { rawText: '[[Test Note]]' },
      } as any;

      const trigger = TriggerFactory.createPlaceholderTrigger(
        sourceUri,
        'Source Note',
        mockLocation
      );

      expect(trigger.type).toBe('placeholder');
      if (!isPlaceholderTrigger(trigger)) {
        throw new Error('Expected placeholder trigger type');
      }
      expect(trigger.sourceNote).toMatchObject({
        uri: sourceUri.toString(),
        title: 'Source Note',
        location: mockLocation,
      });
    });
  });

  describe('filepath sanitization', () => {
    it('should sanitize invalid characters in filepath from template', async () => {
      const { engine } = await setupFoamEngine();

      const template: Template = {
        type: 'markdown',
        content: `---
foam_template:
  filepath: \${FOAM_TITLE}.md
---
# \${FOAM_TITLE}`,
        metadata: new Map(),
      };

      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      // Title with many invalid characters
      const resolver = new Resolver(new Map(), new Date());
      resolver.define('FOAM_TITLE', 'Test#%&{}<>?*$!\'"Title@+`|=');

      const result = await engine.processTemplate(trigger, template, resolver);

      // All invalid characters should become dashes, and valid should stay unchanged
      expect(result.filepath.path).toBe("Test#%&{}----$!'-Title@+`-=.md");

      // Content should remain unchanged
      expect(result.content).toContain('# Test#%&{}<>?*$!\'"Title@+`|=');
    });

    it('should not affect FOAM_TITLE when not used in filepath', async () => {
      const { engine } = await setupFoamEngine();

      // Template with static filepath, FOAM_TITLE only in content
      const template: Template = {
        type: 'markdown',
        content: `---
foam_template:
  filepath: notes/static-file.md
---
# \${FOAM_TITLE}

Content with \${FOAM_TITLE} should remain unchanged.`,
        metadata: new Map(),
      };

      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      const resolver = new Resolver(new Map(), new Date());
      resolver.define('FOAM_TITLE', 'Invalid "Characters" <Test>');

      const result = await engine.processTemplate(trigger, template, resolver);

      // Filepath should remain static (no sanitization needed)
      expect(result.filepath.path).toBe('notes/static-file.md');

      // Content should use original FOAM_TITLE with invalid characters
      expect(result.content).toContain('# Invalid "Characters" <Test>');
      expect(result.content).toContain(
        'Content with Invalid "Characters" <Test> should remain'
      );
    });

    it('should sanitize complex filepath patterns with multiple variables', async () => {
      const { engine } = await setupFoamEngine();

      const template: Template = {
        type: 'markdown',
        content: `---
foam_template:
  filepath: \${FOAM_DATE_YEAR}/\${FOAM_DATE_MONTH}/\${FOAM_TITLE}.md
---
# \${FOAM_TITLE}

Date and title combination.`,
        metadata: new Map(),
      };

      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      const testDate = new Date('2024-03-15');
      const resolver = new Resolver(new Map(), testDate);
      resolver.define('FOAM_TITLE', 'Note:With|Invalid*Chars');
      resolver.define('FOAM_DATE_YEAR', '2024');
      resolver.define('FOAM_DATE_MONTH', '03');

      const result = await engine.processTemplate(trigger, template, resolver);

      // Entire resolved filepath should be sanitized
      expect(result.filepath.path).toBe('2024/03/Note:With-Invalid-Chars.md');

      // Content should use original FOAM_TITLE
      expect(result.content).toContain('# Note:With|Invalid*Chars');
    });

    it('should handle filepath with no invalid characters', async () => {
      const { engine } = await setupFoamEngine();

      const template: Template = {
        type: 'markdown',
        content: `---
foam_template:
  filepath: notes/\${FOAM_TITLE}.md
---
# \${FOAM_TITLE}`,
        metadata: new Map(),
      };

      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      const resolver = new Resolver(new Map(), new Date());
      resolver.define('FOAM_TITLE', 'ValidTitle123');

      const result = await engine.processTemplate(trigger, template, resolver);

      // No sanitization needed - should remain unchanged
      expect(result.filepath.path).toBe('notes/ValidTitle123.md');
      expect(result.content).toContain('# ValidTitle123');
    });

    it('should preserve backslashes as directory separators (Windows-style paths)', async () => {
      const { engine } = await setupFoamEngine();

      // Simulate a resolved filepath with Windows-style backslash separators
      const template: Template = {
        type: 'markdown',
        content: `# MyNote`,
        metadata: new Map([
          ['filepath', 'areas\\dailies\\2024\\MyNote.md'], // Already resolved, has backslashes
        ]),
      };

      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      const resolver = new Resolver(new Map(), new Date());

      const result = await engine.processTemplate(trigger, template, resolver);

      // Backslashes should be normalized to forward slashes
      expect(result.filepath.path).toBe('areas/dailies/2024/MyNote.md');
      expect(result.content).toContain('# MyNote');
    });

    it('should normalize mixed forward and backslashes', async () => {
      const { engine } = await setupFoamEngine();

      // Simulate a resolved filepath with mixed separators
      const template: Template = {
        type: 'markdown',
        content: `# MyNote`,
        metadata: new Map([
          ['filepath', 'areas/dailies\\2024/MyNote.md'], // Mixed separators
        ]),
      };

      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      const resolver = new Resolver(new Map(), new Date());

      const result = await engine.processTemplate(trigger, template, resolver);

      // Both separators should be normalized to forward slashes
      expect(result.filepath.path).toBe('areas/dailies/2024/MyNote.md');
      expect(result.content).toContain('# MyNote');
    });

    it('should sanitize invalid characters while normalizing backslash separators', async () => {
      const { engine } = await setupFoamEngine();

      // Simulate a resolved filepath with backslash separator and invalid chars
      const template: Template = {
        type: 'markdown',
        content: `# Note:With*Invalid`,
        metadata: new Map([['filepath', 'areas\\Note:With*Invalid.md']]), // Backslash + invalid chars
      };

      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.create-note'
      );

      const resolver = new Resolver(new Map(), new Date());

      const result = await engine.processTemplate(trigger, template, resolver);

      // Backslash normalized to forward slash, invalid chars sanitized
      expect(result.filepath.path).toBe('areas/Note:With-Invalid.md');
      expect(result.content).toContain('# Note:With*Invalid');
    });
  });
});
