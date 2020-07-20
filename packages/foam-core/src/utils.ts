import { titleCase } from 'title-case';

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
};
