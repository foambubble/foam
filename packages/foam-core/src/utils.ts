import { titleCase } from 'title-case';
import glob from 'glob';
import { promisify } from 'util';
import fs from 'fs';
import { NoteGraph } from './note-graph';
import { createNoteFromMarkdown } from './markdown-provider';

const findAllFiles = promisify(glob);

export function dropExtension(path: string): string {
  const parts = path.split('.');
  parts.pop();
  return parts.join('.');
}


/**
 * 
 * @param filename 
 * @returns title cased heading after removing special characters
 */
export const getHeadingFromFileName = (filename: string): string => {
  return titleCase(filename.replace(/[^\w\s]/gi, ' '));
}

export const initializeNoteGraph = async (aboluteDir: string) => {
  const files = await findAllFiles(`${aboluteDir}/**/*.md`, {});
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
}