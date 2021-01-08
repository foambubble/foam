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

/**
 * Parses a URI from value, taking into consideration possible relative paths.
 *
 * @param reference the URI to use as reference in case value is a relative path
 * @param value the value to parse for a URI
 * @returns the URI from the given value. In case of a relative path, the URI will take into account
 * the reference from which it is computed
 */
export const parseUri = (reference: URI, value: string): URI => {
  let uri = URI.parse(value);
  if (uri.scheme === 'file' && !value.startsWith('/')) {
    const [path, fragment] = value.split('#');
    uri = path.length > 0 ? computeRelativeURI(reference, path) : reference;
    if (fragment) {
      uri = uri.with({
        fragment: fragment,
      });
    }
  }
  return uri;
};
