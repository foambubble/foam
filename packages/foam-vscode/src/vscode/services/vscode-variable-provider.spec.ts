/* @unit-ready */
import { Selection, window } from 'vscode';
import { Resolver } from '@foam/core';
import { VsCodeVariableProvider } from './vscode-variable-provider';
import { Variable } from '@foam/core';
import {
  createFile,
  deleteFile,
  showInEditor,
} from '../../test/test-utils-vscode';

describe('VsCodeVariableProvider', () => {
  it('should resolve FOAM_TITLE via input box', async () => {
    const foamTitle = 'My note title';
    const variables = [new Variable('FOAM_TITLE'), new Variable('FOAM_SLUG')];

    vi
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(vi.fn(() => Promise.resolve(foamTitle)));

    const expected = new Map<string, string>();
    expected.set('FOAM_TITLE', foamTitle);
    expected.set('FOAM_SLUG', 'my-note-title');

    const resolver = new Resolver(new Map(), new Date(), undefined, 'default', new VsCodeVariableProvider());
    expect(await resolver.resolveAll(variables)).toEqual(expected);
  });

  describe('FOAM_SELECTED_TEXT', () => {
    it('should resolve with the editor selection', async () => {
      const file = await createFile('Content of note file');
      const { editor } = await showInEditor(file.uri);
      editor.selection = new Selection(0, 11, 1, 0);
      const resolver = new Resolver(new Map(), new Date(), undefined, 'default', new VsCodeVariableProvider());
      expect(await resolver.resolveFromName('FOAM_SELECTED_TEXT')).toEqual(
        'note file'
      );
      await deleteFile(file);
    });

    it('should append FOAM_SELECTED_TEXT with a newline to the template if there is selected text but FOAM_SELECTED_TEXT is not referenced and the template ends in a newline', async () => {
      vi
        .spyOn(window, 'showInputBox')
        .mockImplementationOnce(vi.fn(() => Promise.resolve('My note title')));

      const givenValues = new Map<string, string>();
      givenValues.set('FOAM_SELECTED_TEXT', 'Selected text');
      const resolver = new Resolver(givenValues, new Date(), undefined, 'default', new VsCodeVariableProvider());
      expect(await resolver.resolveText(`# \${FOAM_TITLE}\n`)).toEqual(
        `# My note title\nSelected text\n`
      );
    });

    it('should append FOAM_SELECTED_TEXT with a newline to the template if there is selected text but FOAM_SELECTED_TEXT is not referenced and the template ends in multiple newlines', async () => {
      vi
        .spyOn(window, 'showInputBox')
        .mockImplementationOnce(vi.fn(() => Promise.resolve('My note title')));

      const givenValues = new Map<string, string>();
      givenValues.set('FOAM_SELECTED_TEXT', 'Selected text');
      const resolver = new Resolver(givenValues, new Date(), undefined, 'default', new VsCodeVariableProvider());
      expect(await resolver.resolveText(`# \${FOAM_TITLE}\n\n`)).toEqual(
        `# My note title\n\nSelected text\n`
      );
    });

    it('should append FOAM_SELECTED_TEXT without a newline to the template if there is selected text but FOAM_SELECTED_TEXT is not referenced and the template does not end in a newline', async () => {
      vi
        .spyOn(window, 'showInputBox')
        .mockImplementationOnce(vi.fn(() => Promise.resolve('My note title')));

      const givenValues = new Map<string, string>();
      givenValues.set('FOAM_SELECTED_TEXT', 'Selected text');
      const resolver = new Resolver(givenValues, new Date(), undefined, 'default', new VsCodeVariableProvider());
      expect(await resolver.resolveText(`# \${FOAM_TITLE}`)).toEqual(
        '# My note title\nSelected text'
      );
    });

    it('should not append FOAM_SELECTED_TEXT to a template if there is no selected text and is not referenced', async () => {
      vi
        .spyOn(window, 'showInputBox')
        .mockImplementationOnce(vi.fn(() => Promise.resolve('My note title')));

      const resolver = new Resolver(new Map(), new Date(), undefined, 'default', new VsCodeVariableProvider());
      expect(
        await resolver.resolveText(`\n        # \${FOAM_TITLE}\n        `)
      ).toEqual(`\n        # My note title\n        `);
    });
  });

  describe('FOAM_CURRENT_DIR', () => {
    it('should resolve to workspace root when no active editor', async () => {
      const resolver = new Resolver(new Map(), new Date(), undefined, 'default', new VsCodeVariableProvider());
      const result = await resolver.resolve(new Variable('FOAM_CURRENT_DIR'));
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should resolve to current directory when editor is active', async () => {
      const testFile = await createFile('Test content', [
        'test-dir',
        'test-file.md',
      ]);
      try {
        await showInEditor(testFile.uri);
        const resolver = new Resolver(new Map(), new Date(), undefined, 'default', new VsCodeVariableProvider());
        const result = await resolver.resolve(new Variable('FOAM_CURRENT_DIR'));
        expect(typeof result).toBe('string');
        expect(result).toContain('test-dir');
      } finally {
        await deleteFile(testFile.uri);
      }
    });

    it('should be included in known foam variables', async () => {
      const input = '${FOAM_CURRENT_DIR}';
      const resolver = new Resolver(new Map(), new Date(), undefined, 'default', new VsCodeVariableProvider());
      const result = await resolver.resolveText(input);
      expect(result).not.toEqual(input);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return POSIX-style paths without backslashes for YAML compatibility (issue #1573)', async () => {
      const resolver = new Resolver(new Map(), new Date(), undefined, 'default', new VsCodeVariableProvider());
      const result = await resolver.resolve(new Variable('FOAM_CURRENT_DIR'));
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toContain('\\');
      expect(result).toContain('/');
    });
  });
});
