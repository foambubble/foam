import { Phase, Phases } from './phase';
import { TrainNote } from './train-note';

let phases = new Phases([
  new Phase('Phase 1', 1),
  new Phase('Phase 2', 2),
  new Phase('Phase 3', 4),
  new Phase('Phase 4', 8),
]);
let note = new TrainNote(phases);

describe('Increase Phase', () => {
  it('basic increase', () => {
    note.SetPhase(note.phases.First());
    note.Increase();
    expect(note.CurrentPhase()).toBe(phases.Phase(1));
  });
  it('increase after highest Phase', () => {
    note.SetPhase(note.phases.Last());
    note.Increase();
    expect(note.CurrentPhase()).toBe(phases.Phase(phases.length - 1));
  });
  it('increase throw all', () => {
    note.SetPhase(note.phases.First());
    let i = 0;
    while (i < note.phases.length) {
      expect(note.CurrentPhase()).toBe(phases.Phase(i));
      note.Increase();
      i++;
    }

    note.Increase();
    expect(note.CurrentPhase()).toBe(note.phases.Last());
  });
});

describe('Decrease Phase', () => {
  it('basic decrement', () => {
    note.SetPhase(note.phases.Phase(3));
    note.Decrease();
    expect(note.CurrentPhase()).toBe(note.phases.Phase(2));
  });
  it('decrease first Phase', () => {
    note.SetPhase(note.phases.First());
    note.Decrease();
    expect(note.CurrentPhase()).toBe(note.phases.First());
  });
  it('decrease through all', () => {
    note.SetPhase(note.phases.Last());
    var i = phases.length - 1;
    while (i >= 0) {
      expect(note.CurrentPhase()).toBe(phases.Phase(i));
      note.Decrease();
      i--;
    }

    note.Decrease();
    expect(note.CurrentPhase()).toBe(note.phases.First());
  });
});

describe('Notify', () => {
  it('Calls', () => {
    const observerSpy = jest.spyOn(note.subject, 'Notify');
    note.Increase();
    note.Decrease();
    expect(observerSpy.mock.calls).toHaveLength(2);
  });
});

describe('Set Phase', () => {
  it('Basic Date Test', () => {
    note.SetPhase(phases.First(), new Date('2025-03-31'));
    expect(note.nextReminder.getTime()).toBe(new Date('2025-04-01').getTime());
  });

  it('Increase', () => {
    note.SetPhase(phases.First());
    note.Increase();
    note.nextReminder.setHours(0, 0, 0, 0);

    var origin = new Date();
    origin.setDate(origin.getDate() + note.phases.Phase(1).days);
    origin.setHours(0, 0, 0, 0);

    expect(note.nextReminder.toISOString()).toEqual(origin.toISOString());
  });

  it('Descrease', () => {
    note.SetPhase(phases.Last());
    note.Decrease();
    note.nextReminder.setHours(0, 0, 0, 0);

    var origin = new Date();
    origin.setDate(origin.getDate() + note.phases.Phase(2).days);
    origin.setHours(0, 0, 0, 0);

    expect(note.nextReminder.toISOString()).toEqual(origin.toISOString());
  });
});
