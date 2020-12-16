import {
  IDataStore,
  Event,
  URI,
  FoamConfig,
  IDisposable,
  Logger
} from "foam-core";
import { workspace, FileSystemWatcher, EventEmitter } from "vscode";
import { TextDecoder } from "util";
import { isSome } from "../utils";

export class VsCodeDataStore implements IDataStore, IDisposable {
  onDidCreateEmitter = new EventEmitter<URI>();
  onDidChangeEmitter = new EventEmitter<URI>();
  onDidDeleteEmitter = new EventEmitter<URI>();
  onDidCreate: Event<URI> = this.onDidCreateEmitter.event;
  onDidChange: Event<URI> = this.onDidChangeEmitter.event;
  onDidDelete: Event<URI> = this.onDidDeleteEmitter.event;

  watcher: FileSystemWatcher;
  files: URI[];

  constructor(private config: FoamConfig) {
    this.watcher = workspace.createFileSystemWatcher("**/*");
    this.watcher.onDidCreate(async uri => {
      await this.listFiles();
      if (this.isMatch(uri)) {
        Logger.info("Created: ", uri);
        this.onDidCreateEmitter.fire(uri);
      }
    });
    this.watcher.onDidChange(uri => {
      if (this.isMatch(uri)) {
        Logger.info("Updated: ", uri);
        this.onDidChangeEmitter.fire(uri);
      }
    });
    this.watcher.onDidDelete(uri => {
      if (this.isMatch(uri)) {
        Logger.info("Deleted: ", uri);
        this.files = this.files.filter(f => f.path !== uri.path);
        this.onDidDeleteEmitter.fire(uri);
      }
    });
  }

  async listFiles(): Promise<URI[]> {
    this.files = await workspace.findFiles(
      `{${this.config.includeGlobs.join(",")}}`,
      `{${this.config.ignoreGlobs.join(",")}}`
    );

    return this.files;
  }

  isMatch(uri: URI): boolean {
    return isSome(this.files.find(f => f.path === uri.path));
  }

  async read(uri: URI): Promise<string> {
    return new TextDecoder().decode(await workspace.fs.readFile(uri));
  }

  dispose(): void {
    this.watcher.dispose();
  }
}
