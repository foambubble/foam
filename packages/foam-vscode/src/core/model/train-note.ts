import { Observer, Notifier } from '../utils/observer';
import { Resource } from './note';
import { Phase, Phases } from './phase';

//https://www.phase-6.de/help/knowledge-base/phaseneinstellungen/
export const phases = new Phases([
  new Phase('Phase 1', 0),
  new Phase('Phase 2', 1),
  new Phase('Phase 3', 3),
  new Phase('Phase 4', 9),
  new Phase('Phase 5', 29),
  new Phase('Phase 6', 90),
]);

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
  constructor(observer?: Observer) {
    super();
    this.Attach(observer);
  }

  increase(trainnote: TrainNote) {
    var newPhase = trainnote.phases.Next(trainnote.currentPhase);
    this.setPhase(trainnote, newPhase);
    this.Notify(trainnote);
  }

  decrease(trainnote: TrainNote) {
    var newPhase = trainnote.phases.Return(trainnote.currentPhase);
    this.setPhase(trainnote, newPhase);
    this.Notify(trainnote);
  }

  setPhase(trainnote: TrainNote, phase: Phase, from: Date = new Date()) {
    trainnote.nextReminder = from;
    trainnote.nextReminder.setDate(
      trainnote.nextReminder.getDate() + phase.days
    );
    trainnote.currentPhase = phase;
  }
}
