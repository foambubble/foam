import { URI } from '../core/model/uri';
import { bootstrap } from '../core/model/foam';
import { NoteCreationEngine } from './note-creation-engine';
import { TriggerFactory } from './note-creation-triggers';
import { NoteCreationContext, isCommandTrigger, isPlaceholderTrigger } from './note-creation-types';
import { createTestWorkspace, createTestNote, strToUri } from '../test/test-utils';
import { FileDataStore, Matcher } from '../test/test-datastore';
import { MarkdownResourceProvider } from '../core/services/markdown-provider';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { Logger } from '../core/utils/log';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock VS Code workspace for template processing
jest.mock('../services/editor', () => ({
  ...jest.requireActual('../services/editor'),
  asAbsoluteWorkspaceUri: (uriOrPath: any) => {
    if (typeof uriOrPath === 'string') {
      return URI.file(path.resolve(uriOrPath));
    }
    return uriOrPath;
  },
  readFile: async (uri: any) => {
    return fs.readFileSync(uri.toFsPath(), 'utf-8');
  },
}));

Logger.setLevel('error');

describe('NoteCreationEngine', () => {
  describe('processTemplate', () => {
    it('should process markdown templates correctly', async () => {
      // Set up test environment
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-test-'));
      const templatePath = path.join(tempDir, '.foam', 'templates', 'test.md');
      const templateContent = `---
filepath: test-note.md
---
# \${FOAM_TITLE}

Test content with title: \${FOAM_TITLE}`;

      // Create template file
      fs.mkdirSync(path.dirname(templatePath), { recursive: true });
      fs.writeFileSync(templatePath, templateContent);
      console.log('Template file created at:', templatePath);
      console.log('Template content:', templateContent);

      // Set up Foam workspace
      const readFile = (uri: URI) => Promise.resolve(fs.readFileSync(uri.toFsPath(), 'utf-8'));
      const dataStore = new FileDataStore(readFile, tempDir);
      const matcher = new Matcher([strToUri(tempDir)], ['**/*.md']);
      const parser = createMarkdownParser();
      const provider = new MarkdownResourceProvider(dataStore, parser, ['.md']);
      
      const foam = await bootstrap(matcher, undefined, dataStore, parser, [provider]);
      const engine = new NoteCreationEngine(foam);

      // Create context
      const context: NoteCreationContext = {
        trigger: TriggerFactory.createCommandTrigger('foam-vscode.create-note'),
        template: '.foam/templates/test.md',
        extraParams: { title: 'Test Note' },
        foam,
        expandTemplate: undefined!, // Will be injected by engine
      };

      // Test processing
      const result = await engine.processTemplate(context);
      console.log('Result:', result);

      expect(result.filepath).toBe('Test Note.md');
      expect(result.content).toContain('# Test Note');
      expect(result.content).toContain('Test content with title: Test Note');

      // Clean up
      fs.rmdirSync(tempDir, { recursive: true });
    });

    it('should handle command triggers with date parameters', async () => {
      // Set up test environment
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-test-'));
      const templatePath = path.join(tempDir, '.foam', 'templates', 'daily.md');
      const templateContent = `# Daily Note \${FOAM_DATE_YEAR}-\${FOAM_DATE_MONTH}-\${FOAM_DATE_DATE}

Today is \${FOAM_DATE_DAY_NAME}`;

      // Create template file
      fs.mkdirSync(path.dirname(templatePath), { recursive: true });
      fs.writeFileSync(templatePath, templateContent);

      // Set up Foam workspace
      const readFile = (uri: URI) => Promise.resolve(fs.readFileSync(uri.toFsPath(), 'utf-8'));
      const dataStore = new FileDataStore(readFile, tempDir);
      const matcher = new Matcher([strToUri(tempDir)], ['**/*.md']);
      const parser = createMarkdownParser();
      const provider = new MarkdownResourceProvider(dataStore, parser, ['.md']);
      
      const foam = await bootstrap(matcher, undefined, dataStore, parser, [provider]);
      const engine = new NoteCreationEngine(foam);

      // Create context with date trigger
      const testDate = new Date('2024-01-15');
      const trigger = TriggerFactory.createCommandTrigger('foam-vscode.open-daily-note', { 
        date: testDate 
      });
      
      const context: NoteCreationContext = {
        trigger,
        template: '.foam/templates/daily.md',
        extraParams: { 
          title: '2024-01-15',
          date: testDate,
        },
        foam,
        expandTemplate: undefined!, // Will be injected by engine
      };

      // Test processing
      const result = await engine.processTemplate(context);

      expect(result.content).toContain('Daily Note 2024-01-15');
      expect(result.content).toContain('Today is Monday');

      // Verify trigger type handling
      expect(trigger.type).toBe('command');
      if (isCommandTrigger(trigger)) {
        expect(trigger.command).toBe('foam-vscode.open-daily-note');
        expect(trigger.params).toHaveProperty('date');
      }

      // Clean up
      fs.rmdirSync(tempDir, { recursive: true });
    });

    it('should handle placeholder triggers correctly', async () => {
      // Set up test environment
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-test-'));
      const templatePath = path.join(tempDir, '.foam', 'templates', 'placeholder.md');
      const templateContent = `# \${FOAM_TITLE}

Created from placeholder link.

Content goes here.`;

      // Create template file
      fs.mkdirSync(path.dirname(templatePath), { recursive: true });
      fs.writeFileSync(templatePath, templateContent);

      // Set up Foam workspace with source note
      const sourcePath = path.join(tempDir, 'source.md');
      const sourceContent = '# Source Note\n\nThis links to [[Test Note]].';
      fs.writeFileSync(sourcePath, sourceContent);

      const readFile = (uri: URI) => Promise.resolve(fs.readFileSync(uri.toFsPath(), 'utf-8'));
      const dataStore = new FileDataStore(readFile, tempDir);
      const matcher = new Matcher([strToUri(tempDir)], ['**/*.md']);
      const parser = createMarkdownParser();
      const provider = new MarkdownResourceProvider(dataStore, parser, ['.md']);
      
      const foam = await bootstrap(matcher, undefined, dataStore, parser, [provider]);
      const engine = new NoteCreationEngine(foam);

      // Parse source note to get link location
      const sourceNote = await parser.parse(strToUri(sourcePath), sourceContent);
      const linkLocation = sourceNote.links[0];

      // Create placeholder trigger
      const trigger = TriggerFactory.createPlaceholderTrigger(
        strToUri(sourcePath),
        'Source Note',
        {
          uri: strToUri(sourcePath),
          range: linkLocation.range,
          data: linkLocation,
        } as any
      );

      const context: NoteCreationContext = {
        trigger,
        template: '.foam/templates/placeholder.md',
        extraParams: { title: 'Test Note' },
        foam,
        expandTemplate: undefined!, // Will be injected by engine
      };

      // Test processing
      const result = await engine.processTemplate(context);

      expect(result.content).toContain('# Test Note');
      expect(result.content).toContain('Created from placeholder link');

      // Verify trigger type handling
      expect(trigger.type).toBe('placeholder');
      if (isPlaceholderTrigger(trigger)) {
        expect(trigger.sourceNote.title).toBe('Source Note');
        expect(trigger.sourceNote.uri).toBe(strToUri(sourcePath).toString());
      }

      // Clean up
      fs.rmdirSync(tempDir, { recursive: true });
    });

    it('should generate default filepath when not specified in template', async () => {
      // Set up test environment
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-test-'));
      const templatePath = path.join(tempDir, '.foam', 'templates', 'no-filepath.md');
      const templateContent = `# \${FOAM_TITLE}

Content without filepath metadata.`;

      // Create template file
      fs.mkdirSync(path.dirname(templatePath), { recursive: true });
      fs.writeFileSync(templatePath, templateContent);

      // Set up Foam workspace
      const readFile = (uri: URI) => Promise.resolve(fs.readFileSync(uri.toFsPath(), 'utf-8'));
      const dataStore = new FileDataStore(readFile, tempDir);
      const matcher = new Matcher([strToUri(tempDir)], ['**/*.md']);
      const parser = createMarkdownParser();
      const provider = new MarkdownResourceProvider(dataStore, parser, ['.md']);
      
      const foam = await bootstrap(matcher, undefined, dataStore, parser, [provider]);
      const engine = new NoteCreationEngine(foam);

      const context: NoteCreationContext = {
        trigger: TriggerFactory.createCommandTrigger('foam-vscode.create-note'),
        template: '.foam/templates/no-filepath.md',
        extraParams: { title: 'My New Note' },
        foam,
        expandTemplate: undefined!, // Will be injected by engine
      };

      // Test processing
      const result = await engine.processTemplate(context);

      expect(result.content).toContain('# My New Note');
      expect(result.filepath).toMatch(/My New Note\.md$/); // Should generate from title

      // Clean up
      fs.rmdirSync(tempDir, { recursive: true });
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
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
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