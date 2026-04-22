import { IDisposable } from '../../core/common/lifecycle';
import { Emitter } from '../../core/common/event';
import { IWatcher } from '../../core/services/datastore';
import { URI } from '../../core/model/uri';
import { Event, FileSystemWatcher, TextDocument } from 'vscode';
import { fromVsCodeUri } from '../utils/vsc-utils';

const DEBOUNCE_MS = 100;

export class VsCodeWatcher implements IWatcher, IDisposable {
  public onDidCreateEmitter = new Emitter<URI>();
  public onDidChangeEmitter = new Emitter<URI>();
  public onDidDeleteEmitter = new Emitter<URI>();
  onDidCreate = this.onDidCreateEmitter.event;
  onDidChange = this.onDidChangeEmitter.event;
  onDidDelete = this.onDidDeleteEmitter.event;

  private changeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly vsCodeWatcher: FileSystemWatcher,
    onDidSaveTextDocument?: Event<TextDocument>
  ) {
    vsCodeWatcher.onDidCreate(uri =>
      this.onDidCreateEmitter.fire(fromVsCodeUri(uri))
    );
    vsCodeWatcher.onDidChange(uri =>
      this.fireChange(fromVsCodeUri(uri))
    );
    vsCodeWatcher.onDidDelete(uri =>
      this.onDidDeleteEmitter.fire(fromVsCodeUri(uri))
    );
    onDidSaveTextDocument?.(doc => this.fireChange(fromVsCodeUri(doc.uri)));
  }

  private fireChange(uri: URI): void {
    const key = uri.path;
    const existing = this.changeTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    this.changeTimers.set(
      key,
      setTimeout(() => {
        this.changeTimers.delete(key);
        this.onDidChangeEmitter.fire(uri);
      }, DEBOUNCE_MS)
    );
  }

  dispose(): void {
    for (const timer of this.changeTimers.values()) {
      clearTimeout(timer);
    }
    this.changeTimers.clear();
    this.vsCodeWatcher.dispose();
  }
}
