import { IDisposable } from '../core/common/lifecycle';
import { Emitter } from '../core/common/event';
import { IWatcher } from '../core/services/datastore';
import { URI } from '../core/model/uri';
import { FileSystemWatcher } from 'vscode';
import { fromVsCodeUri } from '../utils/vsc-utils';

export class VsCodeWatcher implements IWatcher, IDisposable {
  public onDidCreateEmitter = new Emitter<URI>();
  public onDidChangeEmitter = new Emitter<URI>();
  public onDidDeleteEmitter = new Emitter<URI>();
  onDidCreate = this.onDidCreateEmitter.event;
  onDidChange = this.onDidChangeEmitter.event;
  onDidDelete = this.onDidDeleteEmitter.event;

  constructor(private readonly vsCodeWatcher: FileSystemWatcher) {
    vsCodeWatcher.onDidCreate(uri =>
      this.onDidCreateEmitter.fire(fromVsCodeUri(uri))
    );
    vsCodeWatcher.onDidChange(uri =>
      this.onDidChangeEmitter.fire(fromVsCodeUri(uri))
    );
    vsCodeWatcher.onDidDelete(uri =>
      this.onDidDeleteEmitter.fire(fromVsCodeUri(uri))
    );
  }
  dispose(): void {
    this.vsCodeWatcher.dispose();
  }
}
