import glob from 'glob';
import { promisify } from 'util';
import fs from 'fs';
import { NoteGraph} from '../../src/note-graph';
import { createNoteFromMarkdown } from '../../src/markdown-provider';

const findAllFiles = promisify(glob);

export const scaffold = async () => {
  const files = await findAllFiles('test/__scaffold__/**/*.md', {});
  const graph = new NoteGraph();
  await Promise.all(
    (await files).map(f => {
      return fs.promises.readFile(f).then(data => {
        const markdown = (data || '').toString();
        graph.setNote(createNoteFromMarkdown(f, markdown));
      });
    })
  );

  return graph;
};