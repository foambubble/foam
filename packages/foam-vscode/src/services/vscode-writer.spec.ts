import { VSCodeWriter } from './vscode-writer';
import {
  createTestWorkspace,
  readFileFromFs,
  createTestNote,
} from '../test/test-utils';
import { Range } from '../core/model/range';
import { getUriInWorkspace, createNote } from '../test/test-utils-vscode';

describe('VS-Code document Save', () => {
  it('shut save VS-Code Document', async () => {
    var newContent = `# Section1 
                      This is a Test with unsaved changes`;
    var foam_workspace = createTestWorkspace();

    // create note
    const noteA = createTestNote({
      uri: getUriInWorkspace().path,
    });
    await createNote(noteA);
    foam_workspace.set(noteA);

    // change note
    noteA.sections = [{ label: newContent, range: Range.create(0, 0) }];

    // save note
    var writer = new VSCodeWriter();
    await writer
      .write(noteA)
      .then(() => readFileFromFs(noteA.uri))
      .then(content => expect(content).toEqual(newContent));
  });
});
