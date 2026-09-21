import fs from 'fs';
import os from 'os';
import path from 'path';
import * as vscode from './vscode-mock';

describe('vscode-mock file operations', () => {
  it('should announce the deletion of the files it removed', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-mock-'));
    const dir = path.join(root, 'folder');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'note.md'), 'hello');
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, '**/*')
    );
    const deleted: string[] = [];
    watcher.onDidDelete(uri => deleted.push(uri.fsPath));

    const edit = new vscode.WorkspaceEdit();
    edit.deleteFile(vscode.Uri.file(dir), {
      recursive: true,
      ignoreIfNotExists: true,
    });
    await vscode.workspace.applyEdit(edit);

    expect(fs.existsSync(dir)).toBe(false);
    expect(deleted).toEqual([path.join(dir, 'note.md')]);

    watcher.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should not announce a deletion that did not happen', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-mock-'));
    const dir = path.join(root, 'folder');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'note.md'), 'hello');
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, '**/*')
    );
    const deleted: string[] = [];
    watcher.onDidDelete(uri => deleted.push(uri.fsPath));

    // A non-recursive delete of a directory fails; `ignoreIfNotExists`
    // swallows the error, but nothing was removed.
    const edit = new vscode.WorkspaceEdit();
    edit.deleteFile(vscode.Uri.file(dir), {
      recursive: false,
      ignoreIfNotExists: true,
    });
    await vscode.workspace.applyEdit(edit);

    expect(fs.existsSync(path.join(dir, 'note.md'))).toBe(true);
    expect(deleted).toEqual([]);

    watcher.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  });
});
