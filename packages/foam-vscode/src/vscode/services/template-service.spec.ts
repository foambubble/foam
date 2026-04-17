/* @unit-ready */
import { getTemplatesDir, getTemplates } from './template-service';
import {
  createFile,
  deleteFile,
  withModifiedFoamConfiguration,
} from '../../test/test-utils-vscode';

describe('getTemplatesDir', () => {
  it('should return the default .foam/templates directory', () => {
    const dir = getTemplatesDir();
    expect(dir.path).toContain('.foam/templates');
  });

  it('should return the custom templates directory when foam.templates.folder is set', async () => {
    await withModifiedFoamConfiguration('templates.folder', 'custom/templates', async () => {
      const dir = getTemplatesDir();
      expect(dir.path).toContain('custom/templates');
      expect(dir.path).not.toContain('.foam/templates');
    });
  });
});

describe('getTemplates', () => {
  it('should find templates in a custom folder when foam.templates.folder is set', async () => {
    await withModifiedFoamConfiguration('templates.folder', 'custom-tpl', async () => {
      const template = await createFile('# Custom template', ['custom-tpl', 'my-template.md']);
      try {
        const templates = await getTemplates();
        const paths = templates.map(t => t.path);
        expect(paths.some(p => p.includes('custom-tpl/my-template.md'))).toBe(true);
      } finally {
        await deleteFile(template.uri);
      }
    });
  });
});
