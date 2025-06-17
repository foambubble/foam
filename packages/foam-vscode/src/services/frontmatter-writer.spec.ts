import { FrontmatterWriter } from './frontmatter-writer';
import matter from 'gray-matter';
import {
  createNote,
  getUriInWorkspace,
  readFile,
} from '../test/test-utils-vscode';
import { createTestTrainNote, createTestWorkspace } from '../test/test-utils';
import { TrainNoteStepper } from '../core/model/train-note';
import { ConsoleWriter } from '../core/services/Writer/console-writer';
import { WriteObserver } from '../core/utils/observer';

describe('VS-Code document Save', () => {
  it('shut save VS-Code Document', async () => {
    createTestWorkspace();
    let note = createTestTrainNote({
      uri: getUriInWorkspace().path,
    });
    let stepper = new TrainNoteStepper(new WriteObserver(new ConsoleWriter()));
    await createNote(note);
    stepper.SetPhase(note, note.phases.First());

    var stringnextReminder = note.nextReminder.toISOString().split('T')[0];
    await new FrontmatterWriter().write(
      {
        currentPhase: note.currentPhase,
        nextReminder: stringnextReminder,
      },
      note.uri
    );

    var file = await readFile(note.uri);
    var frontmatter = matter(file);
    expect(frontmatter.data.currentPhase).toEqual(note.currentPhase);
    expect(frontmatter.data.nextReminder).toBe(stringnextReminder);
  });
});
