import matter from 'gray-matter';
import { Resource } from '../model/note';
import { Range } from '../model/range';
import { TextEdit } from '../services/text-edit';
import { getHeadingFromFileName } from '../utils/index';

export const generateHeading = (
  note: Resource,
  noteText: string,
  eol: string
): TextEdit | null => {
  if (note.sections.some(s => s.level === 1)) {
    return null;
  }

  const fm = matter(noteText);
  // fm.matter is the raw content between the --- delimiters (excludes both delimiters),
  // so add 1 to skip the opening --- and land after the closing ---.
  const contentStartLine = fm.matter ? fm.matter.split(eol).length + 1 : 0;
  const frontmatterExists = contentStartLine > 0;

  let newLineExistsAfterFrontmatter = false;
  if (frontmatterExists) {
    const lines = noteText.split(eol);
    newLineExistsAfterFrontmatter = lines[contentStartLine] === '';
  }

  const paddingStart = frontmatterExists ? eol : '';
  const paddingEnd = newLineExistsAfterFrontmatter ? eol : `${eol}${eol}`;

  return {
    newText: `${paddingStart}# ${getHeadingFromFileName(note.uri.getName())}${paddingEnd}`,
    range: Range.create(contentStartLine, 0, contentStartLine, 0),
  };
};
