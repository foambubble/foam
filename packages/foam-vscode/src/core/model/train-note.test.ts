import { Phase, Phases } from './phase';
import { TrainNote, TrainNoteStepper } from './train-note';

let phases = new Phases([
  new Phase('Phase 1', 1),
  new Phase('Phase 2', 2),
  new Phase('Phase 3', 4),
  new Phase('Phase 4', 8),
]);
let note = new TrainNote(phases);
var stepper = new TrainNoteStepper();

describe('Increase Phase', () => {
  it('basic increase', () => {
    stepper.setPhase(note, note.phases.First());
    stepper.increase(note);
    expect(note.currentPhase).toBe(phases.Phase(1));
  });
  it('increase after highest Phase', () => {
    stepper.setPhase(note, note.phases.Last());
    stepper.increase(note);
    expect(note.currentPhase).toBe(phases.Phase(phases.length - 1));
  });
  it('increase throw all', () => {
    stepper.setPhase(note, note.phases.First());
    let i = 0;
    while (i < note.phases.length) {
      expect(note.currentPhase).toBe(phases.Phase(i));
      stepper.increase(note);
      i++;
    }

    stepper.increase(note);
    expect(note.currentPhase).toBe(note.phases.Last());
  });
});

describe('Decrease Phase', () => {
  it('basic decrement', () => {
    stepper.setPhase(note, note.phases.Phase(3));
    stepper.decrease(note);
    expect(note.currentPhase).toBe(note.phases.Phase(2));
  });
  it('decrease first Phase', () => {
    stepper.setPhase(note, note.phases.First());
    stepper.decrease(note);
    expect(note.currentPhase).toBe(note.phases.First());
  });
  it('decrease through all', () => {
    stepper.setPhase(note, note.phases.Last());
    var i = phases.length - 1;
    while (i >= 0) {
      expect(note.currentPhase).toBe(phases.Phase(i));
      stepper.decrease(note);
      i--;
    }

    stepper.decrease(note);
    expect(note.currentPhase).toBe(note.phases.First());
  });
});

describe('Notify', () => {
  it('Calls', () => {
    const observerSpy = jest.spyOn(stepper, 'Notify');
    stepper.increase(note);
    stepper.decrease(note);
    expect(observerSpy.mock.calls).toHaveLength(2);
  });
});

describe('Set Phase', () => {
  it('Basic Date Test', () => {
    stepper.setPhase(note, phases.First(), new Date('2025-03-31'));
    expect(note.nextReminder.getTime()).toBe(new Date('2025-04-01').getTime());
  });

  it('Increase', () => {
    stepper.setPhase(note, phases.First());
    stepper.increase(note);
    note.nextReminder.setHours(0, 0, 0, 0);

    var origin = new Date();
    origin.setDate(origin.getDate() + note.phases.Phase(1).days);
    origin.setHours(0, 0, 0, 0);

    expect(note.nextReminder.toISOString()).toEqual(origin.toISOString());
  });

  it('Descrease', () => {
    stepper.setPhase(note, phases.Last());
    stepper.decrease(note);
    note.nextReminder.setHours(0, 0, 0, 0);

    var origin = new Date();
    origin.setDate(origin.getDate() + note.phases.Phase(2).days);
    origin.setHours(0, 0, 0, 0);

    expect(note.nextReminder.toISOString()).toEqual(origin.toISOString());
  });
});
