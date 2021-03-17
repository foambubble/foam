import os from 'os';
import detectNewline from 'detect-newline';
import { Position } from '../model/position';
import { TextEdit } from '../index';

/**
 *
 * @param text text on which the textEdit will be applied
 * @param textEdit
 * @returns {string} text with the applied textEdit
 */
export const applyTextEdit = (text: string, textEdit: TextEdit): string => {
  const eol = detectNewline(text) || os.EOL;
  const lines = text.split(eol);
  const characters = text.split('');
  let startOffset = getOffset(lines, textEdit.range.start, eol);
  let endOffset = getOffset(lines, textEdit.range.end, eol);
  const deleteCount = endOffset - startOffset;

  const textToAppend = `${textEdit.newText}`;
  characters.splice(startOffset, deleteCount, textToAppend);
  return characters.join('');
};

const getOffset = (
  lines: string[],
  position: Position,
  eol: string
): number => {
  const eolLen = eol.length;
  let offset = 0;
  let i = 0;
  while (i < position.line && i < lines.length) {
    offset = offset + lines[i].length + eolLen;
    i++;
  }
  return offset + Math.min(position.character, lines[i].length);
};
