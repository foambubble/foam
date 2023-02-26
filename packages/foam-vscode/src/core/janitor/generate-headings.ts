import matter from 'gray-matter';
import { Resource } from '../model/note';
import { Range } from '../model/range';
import { TextEdit } from '../services/text-edit';
import { getHeadingFromFileName } from '../utils';

export const generateHeading = async (
  note: Resource,
  noteText: string,
  eol: string
): Promise<TextEdit | null> => {
  if (!note) {
    return null;
  }

  // TODO now the note.title defaults to file name at parsing time, so this check
  // doesn't work anymore. Decide:
  // - whether do we actually want to continue generate the headings
  // - whether it should be under a config option
  // A possible approach would be around having a `sections` field in the note, and inspect
  // it to see if there is an h1 title. Alternatively parse directly the markdown in this function.
  if (note.title) {
    return null;
  }

  const fm = matter(noteText);
  const contentStartLine = fm.matter.split(eol).length;
  const frontmatterExists = contentStartLine > 0;

  let newLineExistsAfterFrontmatter = false;
  if (frontmatterExists) {
    const lines = noteText.split(eol);
    const index = contentStartLine - 1;
    const line = lines[index];
    newLineExistsAfterFrontmatter = line === '';
  }

  const paddingStart = frontmatterExists ? eol : '';
  const paddingEnd = newLineExistsAfterFrontmatter ? eol : `${eol}${eol}`;

  return {
    newText: `${paddingStart}# ${getHeadingFromFileName(
      note.uri.getName()
    )}${paddingEnd}`,
    range: Range.create(contentStartLine, 0, contentStartLine, 0),
  };
};
