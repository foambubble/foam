import GithubSlugger from 'github-slugger';
import { URI } from '../model/uri';

export const uriToSlug = (uri: URI): string =>
  GithubSlugger.slug(URI.getBasename(uri));
