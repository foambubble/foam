import { TextEdit } from 'foam-core';

/**
 *
 * @param text text on which the textEdit will be applied
 * @param textEdit
 * @returns {string} text with the applied textEdit
 */
export const applyTextEdit = (text: string, textEdit: TextEdit): string => {
  const characters = text.split('');
  const startOffset = textEdit.range.start.offset || 0;
  const endOffset = textEdit.range.end.offset || 0;
  const deleteCount = endOffset - startOffset;

  const textToAppend = `${textEdit.newText}`;
  characters.splice(startOffset, deleteCount, textToAppend);
  return characters.join('');
};
