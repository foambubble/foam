import { IDisposable } from '../../common/lifecycle';
import { Resource } from '.././note';
import { TrainNote, TrainNoteStepper } from '.././train-note';
import { TrainNoteWriter } from '../../services/Writer/train-note-writer';
import { FrontmatterWriter } from '../../../services/frontmatter-writer';
import { WriteObserver } from '../../utils/observer';
import { FoamWorkspace } from './foamWorkspace';
import { Workspace, TrieIdentifier } from './workspace';
import { Phase } from '../phase';

export class TrainNoteWorkspace
  extends Workspace<TrainNote>
  implements IDisposable
{
  private constructor(defaultExtension: string = '.md') {
    super();
    this.defaultExtension = defaultExtension;
  }

  private disposables: IDisposable[] = [];

  private set(id: string, resource: Resource) {
    const isTrainNote = this.IsTrainNote(resource);
    if (!isTrainNote.result) return;

    this.validateTrainNote(isTrainNote.value);
    this._items.set(id, isTrainNote.value);
  }

  private delete(id: string, resource: Resource) {
    const isTrainNote = this.IsTrainNote(resource);
    if (!isTrainNote.result) return;

    this._items.delete(id);
  }

  public today() {
    return this.list().filter(note =>
      TrainNoteWorkspace.isToday(note.nextReminder)
    );
  }

  public late() {
    return this.list().filter(note =>
      TrainNoteWorkspace.isLate(note.nextReminder)
    );
  }

  public get(phase: Phase) {
    return this.list().filter(note => note.currentPhase === phase);
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

  private validateTrainNote(trainnote: TrainNote) {
    if (trainnote.currentPhase === undefined) {
      const stepper = new TrainNoteStepper(
        new WriteObserver(new TrainNoteWriter(new FrontmatterWriter()))
      );
      stepper.increase(trainnote);
    }
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  public static fromWorkspace(workspace: FoamWorkspace): TrainNoteWorkspace {
    const service = new TrainNoteWorkspace();
    workspace
      .list()
      .forEach(res =>
        service.set(new TrieIdentifier(service._items).get(res.uri), res)
      );

    service.disposables.push(
      workspace.onDidAdd(e => service.set(e.id, e.resource)),
      workspace.onDidUpdate(e => service.set(e.id, e.new)),
      workspace.onDidDelete(e => service.delete(e.id, e.resource))
    );

    return service;
  }

  static isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  static isLate(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    return date.getTime() < today.getTime();
  }
}
