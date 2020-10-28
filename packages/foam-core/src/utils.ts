import path from 'path';
import crypto from 'crypto';
import { titleCase } from 'title-case';
import GithubSlugger from 'github-slugger';
import { URI, ID } from './types';

export function isNotNull<T>(value: T | null): value is T {
  return value != null;
}

export function isSome<T>(value: T | null | undefined | void): value is T {
  return value != null;
}

export function isNone<T>(
  value: T | null | undefined | void
): value is null | undefined | void {
  return value == null;
}

export const hash = (text: string) =>
  crypto
    .createHash('sha1')
    .update(text)
    .digest('hex');

export const uriToSlug = (noteUri: URI): string => {
  return GithubSlugger.slug(path.parse(noteUri).name);
};

export const hashURI = (uri: URI): ID => {
  return hash(path.normalize(uri));
};

export const computeRelativeURI = (
  reference: URI,
  relativeSlug: string
): URI => {
  // if no extension is provided, use the same extension as the source file
  const slug =
    path.extname(relativeSlug) !== ''
      ? relativeSlug
      : `${relativeSlug}${path.extname(reference)}`;
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
