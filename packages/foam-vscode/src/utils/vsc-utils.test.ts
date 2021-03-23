import os from 'os';
import { workspace, Uri } from 'vscode';
import { URI } from 'foam-core';
import { fromVsCodeUri, toVsCodeUri } from './vsc-utils';

describe('uri conversion', () => {
  it.skip('uses drive letter casing in windows #488 #507', () => {
    if (os.platform() === 'win32') {
      const uri = workspace.workspaceFolders[0].uri;
      const isDriveUppercase =
        uri.fsPath.charCodeAt(0) >= 'A'.charCodeAt(0) &&
        uri.fsPath.charCodeAt(0) <= 'Z'.charCodeAt(0);
      const [drive, path] = uri.fsPath.split(':');
      const withUppercase = `${drive.toUpperCase()}:${path}`;
      const withLowercase = `${drive.toLowerCase()}:${path}`;
      const expected = isDriveUppercase ? withUppercase : withLowercase;

      expect(fromVsCodeUri(Uri.file(withUppercase))).toEqual(expected);
      expect(fromVsCodeUri(Uri.file(withLowercase))).toEqual(expected);
    }
  });

  it('is consistent when converting from VS Code to Foam URI', () => {
    const vsUri = workspace.workspaceFolders[0].uri;
    const fUri = fromVsCodeUri(vsUri);
    expect(toVsCodeUri(fUri)).toEqual(expect.objectContaining(fUri));
  });

  it('is consistent when converting from Foam to VS Code URI', () => {
    const uri = URI.file(workspace.workspaceFolders[0].uri.fsPath);
    expect(fromVsCodeUri(toVsCodeUri(uri))).toEqual(uri);
  });
});
