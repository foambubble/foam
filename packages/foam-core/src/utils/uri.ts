import path from 'path';
import GithubSlugger from 'github-slugger';
import { URI, ID } from '../types';
import { hash } from './core';

export const uriToSlug = (noteUri: URI): string => {
  return GithubSlugger.slug(path.parse(noteUri).name);
};

export const nameToSlug = (noteName: string): string => {
  return GithubSlugger.slug(noteName);
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
