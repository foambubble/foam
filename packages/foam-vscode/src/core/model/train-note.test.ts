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
    note.currentPhase = note.phases.First();
    note.Increase();
    expect(note.currentPhase).toBe(phases.Phase(1));
  });
  it('increase after highest Phase', () => {
    note.currentPhase = note.phases.Last();
    note.Increase();
    expect(note.currentPhase).toBe(phases.Phase(phases.length - 1));
  });
  it('increase throw all', () => {
    note.currentPhase = note.phases.First();
    let i = 0;
    while (i < note.phases.length) {
      expect(note.currentPhase).toBe(phases.Phase(i));
      note.Increase();
      i++;
    }

    note.Increase();
    expect(note.currentPhase).toBe(note.phases.Last());
  });
});

describe('Decrease Phase', () => {
  it('basic decrement', () => {
    note.currentPhase = note.phases.Phase[3];
    note.Decrease();
    expect(note.currentPhase).toBe(note.phases.Phase[2]);
  });
  it('decrease first Phase', () => {
    note.currentPhase = note.phases.First();
    note.Decrease();
    expect(note.currentPhase).toBe(note.phases.First());
  });
  it('decrease through all', () => {
    note.currentPhase = note.phases.Last();
    var i = phases.length - 1;
    while (i >= 0) {
      expect(note.currentPhase).toBe(phases.Phase(i));
      note.Decrease();
      i--;
    }

    note.Decrease();
    expect(note.currentPhase).toBe(note.phases.First());
  });
});
