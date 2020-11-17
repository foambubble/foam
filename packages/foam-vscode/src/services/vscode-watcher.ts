import { IDisposable, Emitter, URI, IDataStoreWatcher } from "foam-core";
import { FileSystemWatcher } from "vscode";

export class VscodeBaseWatcher implements IDataStoreWatcher, IDisposable {
  onDidChangeEmitter = new Emitter<URI>();
  onDidCreateEmitter = new Emitter<URI>();
  onDidDeleteEmitter = new Emitter<URI>();
  _watcher: FileSystemWatcher;

  constructor(watcher: FileSystemWatcher) {
    watcher.onDidCreate(uri => {
      this.onDidCreateEmitter.fire(uri.fsPath);
    });
    watcher.onDidChange(uri => {
      this.onDidChangeEmitter.fire(uri.fsPath);
    });
    watcher.onDidDelete(uri => {
      this.onDidDeleteEmitter.fire(uri.fsPath);
    });
    this._watcher = watcher;
  }

  dispose(): void {
    this.onDidChangeEmitter.dispose();
    this.onDidCreateEmitter.dispose();
    this.onDidDeleteEmitter.dispose();
    this._watcher.dispose();
  }
}
