import { ConsoleWriter } from '../services/Writer/console-writer';
import { TrainNoteWriter } from '../services/Writer/train-note-writer';
import { Subject, WriteObserver } from '../utils/observer';
import { Resource } from './note';
import { Phase, Phases } from './phase';

export class TrainNote extends Resource {
  nextReminder: Date;
  currentPhase: Phase;
  phases: Phases;
  subject: Subject;

  constructor(phases: Phases) {
    super();
    this.phases = phases;
    this.Attach();
  }

  Increase() {
    this.currentPhase = this.phases.Next(this.currentPhase);
    this.subject.Notify();
  }

  Decrease() {
    this.currentPhase = this.phases.Return(this.currentPhase);
    this.subject.Notify();
  }

  private Attach() {
    this.subject = new Subject();
    this.subject.Attach(
      new WriteObserver(new TrainNoteWriter(new ConsoleWriter()))
    );
  }
}
