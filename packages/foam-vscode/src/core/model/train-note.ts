import { Observer, Notifier } from '../utils/observer';
import { Resource } from './note';
import { Phase, Phases } from './phase';

export class TrainNote extends Resource {
  nextReminder: Date;
  phases: Phases;
  currentPhase: Phase;

  constructor(phases: Phases) {
    super();
    this.phases = phases;
  }
}

export class TrainNoteStepper extends Notifier {
  constructor(observer: Observer) {
    super();
    this.Attach(observer);
  }

  Increase(trainnote: TrainNote) {
    var newPhase = trainnote.phases.Next(trainnote.currentPhase);
    this.SetPhase(trainnote, newPhase);
    this.Notify();
  }

  Decrease(trainnote: TrainNote) {
    var newPhase = trainnote.phases.Return(trainnote.currentPhase);
    this.SetPhase(trainnote, newPhase);
    this.Notify();
  }

  SetPhase(trainnote: TrainNote, phase: Phase, from: Date = new Date()) {
    trainnote.nextReminder = from;
    trainnote.nextReminder.setDate(
      trainnote.nextReminder.getDate() + phase.days
    );
    trainnote.currentPhase = phase;
  }
}
