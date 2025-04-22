import { FrontmatterWriter } from './frontmatter-writer';
import { TrainNote } from '../core/model/train-note';
import { Phase, Phases } from '../core/model/phase';

describe('VS-Code document Save', () => {
  it('shut save VS-Code Document', async () => {
    let phases = new Phases([
      new Phase('Phase 1', 1),
      new Phase('Phase 2', 2),
      new Phase('Phase 3', 4),
      new Phase('Phase 4', 8),
    ]);
    let note = new TrainNote(phases);
    new FrontmatterWriter().write(note);

    expect(2).toBe(3);
  });
});
