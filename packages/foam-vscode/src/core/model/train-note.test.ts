import { ConsoleWriter } from '../services/Writer/console-writer';
import { WriteObserver } from '../utils/observer';
import { Phase, Phases } from './phase';
import { TrainNote, TrainNoteStepper } from './train-note';

let phases = new Phases([
  new Phase('Phase 1', 1),
  new Phase('Phase 2', 2),
  new Phase('Phase 3', 4),
  new Phase('Phase 4', 8),
]);
let note = new TrainNote(phases);
var stepper = new TrainNoteStepper(new WriteObserver(new ConsoleWriter()));

describe('Increase Phase', () => {
  it('basic increase', () => {
    stepper.SetPhase(note, note.phases.First());
    stepper.Increase(note);
    expect(note.currentPhase).toBe(phases.Phase(1));
  });
  it('increase after highest Phase', () => {
    stepper.SetPhase(note, note.phases.Last());
    stepper.Increase(note);
    expect(note.currentPhase).toBe(phases.Phase(phases.length - 1));
  });
  it('increase throw all', () => {
    stepper.SetPhase(note, note.phases.First());
    let i = 0;
    while (i < note.phases.length) {
      expect(note.currentPhase).toBe(phases.Phase(i));
      stepper.Increase(note);
      i++;
    }

    stepper.Increase(note);
    expect(note.currentPhase).toBe(note.phases.Last());
  });
});

describe('Decrease Phase', () => {
  it('basic decrement', () => {
    stepper.SetPhase(note, note.phases.Phase(3));
    stepper.Decrease(note);
    expect(note.currentPhase).toBe(note.phases.Phase(2));
  });
  it('decrease first Phase', () => {
    stepper.SetPhase(note, note.phases.First());
    stepper.Decrease(note);
    expect(note.currentPhase).toBe(note.phases.First());
  });
  it('decrease through all', () => {
    stepper.SetPhase(note, note.phases.Last());
    var i = phases.length - 1;
    while (i >= 0) {
      expect(note.currentPhase).toBe(phases.Phase(i));
      stepper.Decrease(note);
      i--;
    }

    stepper.Decrease(note);
    expect(note.currentPhase).toBe(note.phases.First());
  });
});

describe('Notify', () => {
  it('Calls', () => {
    const observerSpy = jest.spyOn(stepper, 'Notify');
    stepper.Increase(note);
    stepper.Decrease(note);
    expect(observerSpy.mock.calls).toHaveLength(2);
  });
});

describe('Set Phase', () => {
  it('Basic Date Test', () => {
    stepper.SetPhase(note, phases.First(), new Date('2025-03-31'));
    expect(note.nextReminder.getTime()).toBe(new Date('2025-04-01').getTime());
  });

  it('Increase', () => {
    stepper.SetPhase(note, phases.First());
    stepper.Increase(note);
    note.nextReminder.setHours(0, 0, 0, 0);

    var origin = new Date();
    origin.setDate(origin.getDate() + note.phases.Phase(1).days);
    origin.setHours(0, 0, 0, 0);

    expect(note.nextReminder.toISOString()).toEqual(origin.toISOString());
  });

  it('Descrease', () => {
    stepper.SetPhase(note, phases.Last());
    stepper.Decrease(note);
    note.nextReminder.setHours(0, 0, 0, 0);

    var origin = new Date();
    origin.setDate(origin.getDate() + note.phases.Phase(2).days);
    origin.setHours(0, 0, 0, 0);

    expect(note.nextReminder.toISOString()).toEqual(origin.toISOString());
  });
});
