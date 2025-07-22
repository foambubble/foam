/* @unit-ready */
import dateFormat from 'dateformat';
import { commands, window } from 'vscode';

describe('open-daily-note-for-date command', () => {
  it('offers to pick which date to use', async () => {
    const spy = jest
      .spyOn(window, 'showQuickPick')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(undefined)));

    await commands.executeCommand('foam-vscode.open-daily-note-for-date');

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining([
        expect.objectContaining({
          label: expect.stringContaining(
            dateFormat(new Date(), 'mmm dd, yyyy')
          ),
        }),
      ]),
      {
        placeHolder: 'Choose or type a date (YYYY-MM-DD)',
        matchOnDescription: true,
        matchOnDetail: true,
      }
    );
  });
});
