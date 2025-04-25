import { FrontmatterWriter } from './frontmatter-writer';
import matter from 'gray-matter';
import {
  createNote,
  getUriInWorkspace,
  readFile,
} from '../test/test-utils-vscode';
import { createTestTrainNote, createTestWorkspace } from '../test/test-utils';

describe('VS-Code document Save', () => {
  it('shut save VS-Code Document', async () => {
    createTestWorkspace();
    let note = createTestTrainNote({
      uri: getUriInWorkspace().path,
    });
    await createNote(note);
    note.SetPhase(note.phases.First());

    var stringnextReminder = note.nextReminder.toISOString().split('T')[0];
    await new FrontmatterWriter().write(
      {
        currentPhase: note.CurrentPhase(),
        nextReminder: stringnextReminder,
      },
      note.uri
    );

    var file = await readFile(note.uri);
    var frontmatter = matter(file);
    expect(frontmatter.data.currentPhase).toEqual(note.CurrentPhase());
    expect(frontmatter.data.nextReminder).toBe(stringnextReminder);
  });
});
