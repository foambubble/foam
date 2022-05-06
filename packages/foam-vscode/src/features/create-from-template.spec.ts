import { Uri, commands, window, workspace } from 'vscode';
import { URI } from '../core/model/uri';
import { toVsCodeUri } from '../utils/vsc-utils';
import { createFile } from '../test/test-utils-vscode';
import * as editor from '../services/editor';

describe('Create from template commands', () => {
  describe('create-note-from-template', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('offers to create template when none are available', async () => {
      const spy = jest
        .spyOn(window, 'showQuickPick')
        .mockImplementationOnce(jest.fn(() => Promise.resolve(undefined)));

      await commands.executeCommand('foam-vscode.create-note-from-template');

      expect(spy).toBeCalledWith(['Yes', 'No'], {
        placeHolder:
          'No templates available. Would you like to create one instead?',
      });
    });

    it('offers to pick which template to use', async () => {
      const templateA = await createFile('Template A', [
        '.foam',
        'templates',
        'template-a.md',
      ]);
      const templateB = await createFile('Template A', [
        '.foam',
        'templates',
        'template-b.md',
      ]);

      const spy = jest
        .spyOn(window, 'showQuickPick')
        .mockImplementationOnce(jest.fn(() => Promise.resolve(undefined)));

      await commands.executeCommand('foam-vscode.create-note-from-template');

      expect(spy).toBeCalledWith(
        [
          expect.objectContaining({ label: 'template-a.md' }),
          expect.objectContaining({ label: 'template-b.md' }),
        ],
        {
          placeHolder: 'Select a template to use.',
        }
      );

      await workspace.fs.delete(toVsCodeUri(templateA.uri));
      await workspace.fs.delete(toVsCodeUri(templateB.uri));
    });

    it('Uses template metadata to improve dialog box', async () => {
      const templateA = await createFile(
        `---
foam_template:
  name: My Template
  description: My Template description
---

Template A
      `,
        ['.foam', 'templates', 'template-a.md']
      );

      const spy = jest
        .spyOn(window, 'showQuickPick')
        .mockImplementationOnce(jest.fn(() => Promise.resolve(undefined)));

      await commands.executeCommand('foam-vscode.create-note-from-template');

      expect(spy).toBeCalledWith(
        [
          expect.objectContaining({
            label: 'My Template',
            description: 'template-a.md',
            detail: 'My Template description',
          }),
        ],
        expect.anything()
      );

      await workspace.fs.delete(toVsCodeUri(templateA.uri));
    });
  });

  describe('create-note-from-default-template', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('can be cancelled while resolving FOAM_TITLE', async () => {
      const spy = jest
        .spyOn(window, 'showInputBox')
        .mockImplementation(jest.fn(() => Promise.resolve(undefined)));

      const docCreatorSpy = jest.spyOn(editor, 'createDocAndFocus');

      await commands.executeCommand(
        'foam-vscode.create-note-from-default-template'
      );

      expect(spy).toBeCalledWith({
        prompt: `Enter a title for the new note`,
        value: 'Title of my New Note',
        validateInput: expect.anything(),
      });

      expect(docCreatorSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('create-new-template', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should create a new template', async () => {
      const template = Uri.joinPath(
        workspace.workspaceFolders[0].uri,
        '.foam',
        'templates',
        'hello-world.md'
      ).fsPath;

      window.showInputBox = jest.fn(() => {
        return Promise.resolve(template);
      });

      await commands.executeCommand('foam-vscode.create-new-template');

      const file = await workspace.fs.readFile(toVsCodeUri(URI.file(template)));
      expect(window.showInputBox).toHaveBeenCalled();
      expect(file).toBeDefined();
    });

    it('can be cancelled', async () => {
      // This is the default template which would be created.
      const template = Uri.joinPath(
        workspace.workspaceFolders[0].uri,
        '.foam',
        'templates',
        'new-template.md'
      ).fsPath;
      window.showInputBox = jest.fn(() => {
        return Promise.resolve(undefined);
      });

      await commands.executeCommand('foam-vscode.create-new-template');

      expect(window.showInputBox).toHaveBeenCalled();
      await expect(
        workspace.fs.readFile(toVsCodeUri(URI.file(template)))
      ).rejects.toThrow();
    });
  });
});
