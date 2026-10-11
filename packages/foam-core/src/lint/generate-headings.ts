import { Resource } from '../model/note';
import { Range } from '../model/range';
import { TextEdit } from '../services/text-edit';
import { getHeadingFromFileName } from '../utils/index';
import { getFrontMatterRange } from '../utils/md';

export const generateHeading = (
  note: Resource,
  noteText: string,
  eol: string
): TextEdit | null => {
  if (note.sections.some(s => s.level === 1)) {
    return null;
  }

  const frontMatter = getFrontMatterRange(noteText);
  const contentStartLine = frontMatter ? frontMatter.end.line + 1 : 0;
  const frontmatterExists = frontMatter !== null;

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
