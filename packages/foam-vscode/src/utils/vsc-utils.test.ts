import os from 'os';
import { workspace, Uri } from 'vscode';
import { URI } from 'foam-core';
import { fromVsCodeUri, toVsCodeUri } from './vsc-utils';

describe('uri conversion', () => {
  it('uses drive letter casing in windows #488 #507', () => {
    if (os.platform() === 'win32') {
      const uri = workspace.workspaceFolders[0].uri;
      const isDriveUppercase =
        uri.fsPath.charCodeAt(0) >= 'A'.charCodeAt(0) &&
        uri.fsPath.charCodeAt(0) <= 'Z'.charCodeAt(0);
      const [drive, path] = uri.fsPath.split(':');
      const posixPath = path.replace(/\\/g, '/');

      const withUppercase = `/${drive.toUpperCase()}:${posixPath}`;
      const withLowercase = `/${drive.toLowerCase()}:${posixPath}`;
      const expected = isDriveUppercase ? withUppercase : withLowercase;

      expect(fromVsCodeUri(Uri.file(withUppercase)).path).toEqual(expected);
      expect(fromVsCodeUri(Uri.file(withLowercase)).path).toEqual(expected);
    }
  });

  it('correctly parses file paths', () => {
    const test = workspace.workspaceFolders[0].uri;
    const uri = URI.file(test.fsPath);
    expect(uri).toEqual(
      URI.create({
        scheme: 'file',
        path: test.path,
      })
    );
  });

  it('creates a proper string representation for file uris', () => {
    const test = workspace.workspaceFolders[0].uri;
    const uri = URI.file(test.fsPath);
    expect(URI.toString(uri)).toEqual(test.toString());
  });

  it('is consistent when converting from VS Code to Foam URI', () => {
    const vsUri = workspace.workspaceFolders[0].uri;
    const fUri = fromVsCodeUri(vsUri);
    expect(toVsCodeUri(fUri)).toEqual(expect.objectContaining(fUri));
  });

  it('is consistent when converting from Foam to VS Code URI', () => {
    const test = workspace.workspaceFolders[0].uri;
    const uri = URI.file(test.fsPath);
    const fUri = toVsCodeUri(uri);
    expect(fUri).toEqual(
      expect.objectContaining({
        scheme: 'file',
        path: test.path,
      })
    );
    expect(fromVsCodeUri(fUri)).toEqual(uri);
  });
});
