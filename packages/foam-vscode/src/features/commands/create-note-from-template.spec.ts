import { commands, window, workspace } from 'vscode';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { createFile } from '../../test/test-utils-vscode';

describe('create-note-from-template command', () => {
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
