import TrieMap from 'mnemonist/trie-map';
import { IDisposable } from '../common/lifecycle';
import { Resource } from './note';
import { TrainNote } from './train-note';
import { FoamWorkspace } from './workspace/foamWorkspace';

export class TrainNoteService implements IDisposable {
  private constructor() {}

  private _resources: TrieMap<string, TrainNote> = new TrieMap();
  private disposables: IDisposable[] = [];

  public Set(id: string, resource: Resource) {
    const isTrainNote = this.IsTrainNote(resource);
    if (!isTrainNote.result) return;

    this._resources.set(id, isTrainNote.value);
  }

  public Delete(id: string, resource: Resource) {
    const isTrainNote = this.IsTrainNote(resource);
    if (!isTrainNote.result) return;

    this._resources.delete(id);
  }

  private IsTrainNote(resource: Resource): {
    result: boolean;
    value: TrainNote;
  } {
    if (resource instanceof TrainNote) {
      return { result: true, value: resource as TrainNote };
    }

    return { result: false, value: null };
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  public static fromWorkspace(workspace: FoamWorkspace): TrainNoteService {
    const service = new TrainNoteService();
    service.disposables.push(
      workspace.onDidAdd(service.Set.bind(service)),
      workspace.onDidUpdate(e => service.Set(e.id, e.new)),
      workspace.onDidDelete(service.Delete.bind(service))
    );

    return service;
  }
}
