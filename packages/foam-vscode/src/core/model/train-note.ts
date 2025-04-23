import { ConsoleWriter } from '../services/Writer/console-writer';
import { TrainNoteWriter } from '../services/Writer/train-note-writer';
import { Subject, WriteObserver } from '../utils/observer';
import { Resource } from './note';
import { Phase, Phases } from './phase';

export class TrainNote extends Resource {
  nextReminder: Date;
  phases: Phases;
  subject: Subject;
  private currentPhase: Phase;

  constructor(phases: Phases) {
    super();
    this.phases = phases;
    this.Attach();
  }

  Increase() {
    var newPhase = this.phases.Next(this.currentPhase);
    this.SetPhase(newPhase);
    this.subject.Notify();
  }

  Decrease() {
    var newPhase = this.phases.Return(this.currentPhase);
    this.SetPhase(newPhase);
    this.subject.Notify();
  }

  CurrentPhase() {
    return this.currentPhase;
  }

  SetPhase(phase: Phase, from: Date = new Date()) {
    this.nextReminder = from
    this.nextReminder.setDate(this.nextReminder.getDate() + phase.days);
    this.currentPhase = phase;
  }

  private Attach() {
    this.subject = new Subject();
    this.subject.Attach(
      new WriteObserver(new TrainNoteWriter(new ConsoleWriter()))
    );
  }
}
