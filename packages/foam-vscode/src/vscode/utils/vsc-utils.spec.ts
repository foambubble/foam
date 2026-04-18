import { Uri } from 'vscode';
import { fromVsCodeUri, toVsCodeUri } from './vsc-utils';

describe('URI conversion', () => {
  it('converts between Foam and VS Code URI', () => {
    const vsUnixUri = Uri.file('/this/is/a/path');
    const fUnixUri = fromVsCodeUri(vsUnixUri);
    expect(toVsCodeUri(fUnixUri)).toEqual(expect.objectContaining(fUnixUri));

    const vsWinUpperDriveUri = Uri.file('C:\\this\\is\\a\\path');
    const fWinUpperUri = fromVsCodeUri(vsWinUpperDriveUri);
    expect(toVsCodeUri(fWinUpperUri)).toEqual(
      expect.objectContaining(fWinUpperUri)
    );

    const vsWinLowerUri = Uri.file('c:\\this\\is\\a\\path');
    const fWinLowerUri = fromVsCodeUri(vsWinLowerUri);
    expect(toVsCodeUri(fWinLowerUri)).toEqual(
      expect.objectContaining({
        ...fWinLowerUri,
        path: fWinUpperUri.path, // path is normalized to upper case
      })
    );
  });
});
