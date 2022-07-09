import { commands, window } from 'vscode';
import * as editor from '../../services/editor';

describe('create-note-from-default-template command', () => {
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
