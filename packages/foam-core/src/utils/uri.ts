import { posix } from 'path';
import GithubSlugger from 'github-slugger';
import { hash } from './core';
import { URI } from '../common/uri';

export const uriToSlug = (noteUri: URI): string => {
  return GithubSlugger.slug(posix.parse(noteUri.path).name);
};

export const nameToSlug = (noteName: string): string => {
  return GithubSlugger.slug(noteName);
};

export const hashURI = (uri: URI): string => {
  return hash(posix.normalize(uri.path));
};

export const computeRelativePath = (source: URI, target: URI): string => {
  const relativePath = posix.relative(posix.dirname(source.path), target.path);
  return relativePath;
};

export const getBasename = (uri: URI) => posix.parse(uri.path).name;

export const computeRelativeURI = (
  reference: URI,
  relativeSlug: string
): URI => {
  // if no extension is provided, use the same extension as the source file
  const slug =
    posix.extname(relativeSlug) !== ''
      ? relativeSlug
      : `${relativeSlug}${posix.extname(reference.path)}`;
  return reference.with({
    path: posix.join(posix.dirname(reference.path), slug),
  });
};
