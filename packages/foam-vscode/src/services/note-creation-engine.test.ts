import { NoteCreationEngine } from './note-creation-engine';
import { TriggerFactory } from './note-creation-triggers';
import {
  Template,
  isCommandTrigger,
  isPlaceholderTrigger,
} from './note-creation-types';
import {
  createTestWorkspace,
  readFileFromFs,
  strToUri,
} from '../test/test-utils';
import { bootstrap } from '../core/model/foam';
import { FileDataStore, Matcher } from '../test/test-datastore';
import { MarkdownResourceProvider } from '../core/services/markdown-provider';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { Logger } from '../core/utils/log';
import { URI } from '../core/model/uri';

Logger.setLevel('error');

describe('NoteCreationEngine', () => {
  let foam: any;
  let engine: NoteCreationEngine;

  beforeEach(async () => {
    // Set up Foam workspace (minimal setup for testing)
    const dataStore = new FileDataStore(readFileFromFs, '/tmp');
    const matcher = new Matcher([strToUri('/tmp')], ['**/*.md']);
    const parser = createMarkdownParser();
    const provider = new MarkdownResourceProvider(dataStore, parser, ['.md']);
    foam = await bootstrap(matcher, undefined, dataStore, parser, [provider]);
    engine = new NoteCreationEngine(foam);
  });
  describe('processTemplate', () => {
    it('should process markdown templates correctly', async () => {
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

      // Test processing
      const result = await engine.processTemplate(trigger, template, {
        title: 'Test Note',
      });

      expect(result.filepath).toBe('test-note.md');
      expect(result.content).toContain('# Test Note');
      expect(result.content).toContain('Test content with title: Test Note');
    });

    it('should handle command triggers with date parameters', async () => {
      // Create markdown template with date variables
      const template: Template = {
        type: 'markdown',
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

      // Test processing with date variables in extraParams
      const result = await engine.processTemplate(trigger, template, {
        title: '2024-01-15',
        FOAM_DATE_YEAR: '2024',
        FOAM_DATE_MONTH: '01',
        FOAM_DATE_DATE: '15',
        FOAM_DATE_DAY_NAME: 'Monday',
      });

      expect(result.content).toContain('Daily Note 2024-01-15');
      expect(result.content).toContain('Today is Monday');

      // Verify trigger type handling
      expect(trigger.type).toBe('command');
      if (isCommandTrigger(trigger)) {
        expect(trigger.command).toBe('foam-vscode.open-daily-note');
        expect(trigger.params).toHaveProperty('date');
      }
    });

    it('should handle placeholder triggers correctly', async () => {
      // Create markdown template
      const template: Template = {
        type: 'markdown',
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

      // Test processing
      const result = await engine.processTemplate(trigger, template, {
        title: 'Test Note',
      });

      expect(result.content).toContain('# Test Note');
      expect(result.content).toContain('Created from placeholder link');

      // Verify trigger type handling
      expect(trigger.type).toBe('placeholder');
      if (isPlaceholderTrigger(trigger)) {
        expect(trigger.sourceNote.title).toBe('Source Note');
        expect(trigger.sourceNote.uri).toBe(
          strToUri('/test/source.md').toString()
        );
      }
    });

    it('should generate default filepath when not specified in template', async () => {
      // Create markdown template without filepath metadata
      const template: Template = {
        type: 'markdown',
        content: `# \${FOAM_TITLE}

Content without filepath metadata.`,
      };

      // Test processing
      const result = await engine.processTemplate(
        TriggerFactory.createCommandTrigger('foam-vscode.create-note'),
        template,
        { title: 'My New Note' }
      );

      expect(result.content).toContain('# My New Note');
      expect(result.filepath).toBe('My New Note.md'); // Should generate from title
    });

    it('should handle JavaScript templates correctly', async () => {
      // Create JavaScript template
      const template: Template = {
        type: 'javascript',
        createNote: async context => {
          const title = context.extraParams.title || 'Untitled';
          const content = `# ${title}\n\nGenerated by JavaScript template\n\nTrigger: ${context.trigger.type}`;
          return {
            filepath: `${title.replace(/\s+/g, '-').toLowerCase()}.md`,
            content,
          };
        },
      };

      // Test processing
      const result = await engine.processTemplate(
        TriggerFactory.createCommandTrigger('foam-vscode.create-note'),
        template,
        { title: 'JS Generated Note' }
      );

      expect(result.content).toContain('# JS Generated Note');
      expect(result.content).toContain('Generated by JavaScript template');
      expect(result.content).toContain('Trigger: command');
      expect(result.filepath).toBe('js-generated-note.md');
    });
  });

  describe('trigger validation', () => {
    it('should validate command triggers', () => {
      const trigger = TriggerFactory.createCommandTrigger(
        'foam-vscode.open-daily-note',
        { date: new Date() }
      );

      expect(trigger.type).toBe('command');
      if (isCommandTrigger(trigger)) {
        expect(trigger.command).toBe('foam-vscode.open-daily-note');
        expect(trigger.params).toHaveProperty('date');
      }
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
      if (isPlaceholderTrigger(trigger)) {
        expect(trigger.sourceNote).toMatchObject({
          uri: sourceUri.toString(),
          title: 'Source Note',
          location: mockLocation,
        });
      }
    });
  });
});
