import { URI } from '../model/uri';
import { TemplateLoader } from './template-loader';

/** Minimal in-memory readFile stub — no filesystem, no VS Code. */
function makeReadFile(files: Record<string, string>) {
  return async (uri: URI): Promise<string> => {
    const content = files[uri.toFsPath()];
    if (content === undefined) {
      throw new Error(`File not found: ${uri.toFsPath()}`);
    }
    return content;
  };
}

describe('TemplateLoader', () => {
  describe('workspace trust', () => {
    it('should throw error when loading JS template in untrusted workspace', async () => {
      const uri = URI.file('/templates/daily-note.js');
      const readFile = makeReadFile({
        [uri.toFsPath()]: 'function createNote() { return { filepath: "test.md", content: "test" }; }',
      });
      const loader = new TemplateLoader(readFile, false);

      await expect(loader.loadTemplate(uri)).rejects.toThrow(
        'JavaScript templates can only be used in trusted workspaces for security reasons'
      );
    });

    it('should load JS template successfully in trusted workspace', async () => {
      const uri = URI.file('/templates/daily-note.js');
      const readFile = makeReadFile({
        [uri.toFsPath()]: `
          function createNote(context) {
            return { filepath: 'test-note.md', content: '# Test Note' };
          }
        `,
      });
      const loader = new TemplateLoader(readFile, true);

      const template = await loader.loadTemplate(uri);

      expect(template.type).toBe('javascript');
      if (template.type !== 'javascript') {
        throw new Error('Expected javascript template');
      }
      expect(typeof template.createNote).toBe('function');
    });

    it('should load markdown template regardless of workspace trust', async () => {
      const uri = URI.file('/templates/daily-note.md');
      const content = `---
foam_template:
  filepath: "/journal/2024-01-01.md"
---
# My Note`;
      const readFile = makeReadFile({ [uri.toFsPath()]: content });
      const loader = new TemplateLoader(readFile, false);

      const template = await loader.loadTemplate(uri);

      expect(template.type).toBe('markdown');
      if (template.type !== 'markdown') {
        throw new Error('Expected markdown template');
      }
      expect(template.content).toBe(content);
    });
  });
});
