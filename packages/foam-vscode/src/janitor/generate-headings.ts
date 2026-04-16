import matter from 'gray-matter';
import { Resource } from '../core/model/note';
import { Range } from '../core/model/range';
import { TextEdit } from '../core/services/text-edit';
import { getHeadingFromFileName } from '../core/utils';

export const generateHeading = (
  note: Resource,
  noteText: string,
  eol: string
): TextEdit | null => {
  if (note.sections.some(s => s.level === 1)) {
    return null;
  }

  const fm = matter(noteText);
  const contentStartLine = fm.matter ? fm.matter.split(eol).length : 0;
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
    newText: `${paddingStart}# ${getHeadingFromFileName(note.uri.getName())}${paddingEnd}`,
    range: Range.create(contentStartLine, 0, contentStartLine, 0),
  };
};
