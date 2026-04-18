/* @unit-ready */
import dayjs from 'dayjs';
import { commands, window } from 'vscode';

describe('open-daily-note-for-date command', () => {
  it('offers to pick which date to use', async () => {
    const spy = vi
      .spyOn(window, 'showQuickPick')
      .mockImplementationOnce(vi.fn(() => Promise.resolve(undefined)));

    await commands.executeCommand('foam-vscode.open-daily-note-for-date');

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining([
        expect.objectContaining({
          label: expect.stringContaining(
            dayjs(new Date()).format('MMM DD, YYYY')
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
