import path from 'path';
import crypto from 'crypto';
import { titleCase } from 'title-case';
import GithubSlugger from 'github-slugger';
import { URI, ID } from 'types';

export const hash = (text: string) =>
  crypto
    .createHash('md5')
    .update(text)
    .digest('hex');

export const uriToSlug = (noteUri: URI): string => {
  // TODO hack don't merge with this
  const filename = noteUri
    .split('/')
    .slice(-1)[0]
    .split('.')
    .slice(0, -1)
    .join('.');
  return GithubSlugger.slug(filename);
};

export const hashURI = (uri: URI): ID => {
  return hash(path.normalize(uri));
};

export const getUriViaRelative = (
  reference: URI,
  relativeSlug: string
): URI => {
  const slug = relativeSlug.endsWith('.md') // TODO hack
    ? relativeSlug
    : `${relativeSlug}.md`;
  return path.normalize(path.join(path.dirname(reference), slug));
};

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
