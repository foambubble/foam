import { commands, window } from 'vscode';
import { CommandDescriptor } from '../../utils/commands';
import { OpenResourceArgs, OPEN_COMMAND } from './open-resource';
import * as filter from '../../core/services/resource-filter';
import { URI } from '../../core/model/uri';
import { closeEditors, createFile } from '../../test/test-utils-vscode';
import { deleteFile } from '../../services/editor';
import waitForExpect from 'wait-for-expect';

describe('open-resource command', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await closeEditors();
  });

  afterEach(async () => {
    await closeEditors();
  });

  it('URI param has precedence over filter', async () => {
    const spy = jest.spyOn(filter, 'createFilter');
    const noteA = await createFile('Note A for open command');
    
    // Wait for workspace to discover the file
    await new Promise(resolve => setTimeout(resolve, 1000));

    const command: CommandDescriptor<OpenResourceArgs> = {
      name: OPEN_COMMAND.command,
      params: {
        uri: noteA.uri,
        filter: { title: 'note 1' },
      },
    };
    await commands.executeCommand(command.name, command.params);

    await waitForExpect(() => {
      expect(window.activeTextEditor).toBeTruthy();
      expect(window.activeTextEditor.document.uri.path).toEqual(noteA.uri.path);
    });
    expect(spy).not.toHaveBeenCalled();

    await deleteFile(noteA.uri);
  });

  it('URI param accept URI object, or path', async () => {
    const noteA = await createFile('Note A for open command');
    
    // Wait for workspace to discover the file
    await new Promise(resolve => setTimeout(resolve, 1000));

    const uriCommand: CommandDescriptor<OpenResourceArgs> = {
      name: OPEN_COMMAND.command,
      params: {
        uri: noteA.uri,
      },
    };
    await commands.executeCommand(uriCommand.name, uriCommand.params);
    await waitForExpect(() => {
      expect(window.activeTextEditor).toBeTruthy();
      expect(window.activeTextEditor.document.uri.path).toEqual(noteA.uri.path);
    });

    await closeEditors();

    const pathCommand: CommandDescriptor<OpenResourceArgs> = {
      name: OPEN_COMMAND.command,
      params: {
        uri: noteA.uri.path,
      },
    };
    await commands.executeCommand(pathCommand.name, pathCommand.params);
    await waitForExpect(() => {
      expect(window.activeTextEditor).toBeTruthy();
      expect(window.activeTextEditor.document.uri.path).toEqual(noteA.uri.path);
    });
    await deleteFile(noteA.uri);
  });

  it('User is notified if no resource is found with filter', async () => {
    const spy = jest.spyOn(window, 'showInformationMessage');

    const command: CommandDescriptor<OpenResourceArgs> = {
      name: OPEN_COMMAND.command,
      params: {
        filter: { title: 'note 1 with no existing title' },
      },
    };
    await commands.executeCommand(command.name, command.params);

    await waitForExpect(() => {
      expect(spy).toHaveBeenCalled();
    });
  });

  it('User is notified if no resource is found with URI', async () => {
    const spy = jest.spyOn(window, 'showInformationMessage');

    const command: CommandDescriptor<OpenResourceArgs> = {
      name: OPEN_COMMAND.command,
      params: {
        uri: URI.file('path/to/nonexistent.md'),
      },
    };
    await commands.executeCommand(command.name, command.params);

    await waitForExpect(() => {
      expect(spy).toHaveBeenCalled();
    });
  });

  it('filter with multiple results will show a quick pick', async () => {
    const noteA = await createFile('Note A for filter test');
    const noteB = await createFile('Note B for filter test');
    
    // Wait for workspace to discover the files
    await new Promise(resolve => setTimeout(resolve, 1000));

    const spy = jest
      .spyOn(window, 'showQuickPick')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(undefined)));

    const command: CommandDescriptor<OpenResourceArgs> = {
      name: OPEN_COMMAND.command,
      params: {
        filter: { title: '.*' },
      },
    };
    await commands.executeCommand(command.name, command.params);

    await waitForExpect(() => {
      expect(spy).toHaveBeenCalled();
    });

    await deleteFile(noteA.uri);
    await deleteFile(noteB.uri);
  });
});
