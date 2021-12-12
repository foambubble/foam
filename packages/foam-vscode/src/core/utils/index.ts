import { titleCase } from 'title-case';
export { extractHashtags, extractTagsFromProp } from './hashtags';
export * from './core';

/**
 *
 * @param filename
 * @returns title cased heading after removing special characters
 */
export const getHeadingFromFileName = (filename: string): string => {
  return titleCase(filename.replace(/[^\w\s]/gi, ' '));
};
