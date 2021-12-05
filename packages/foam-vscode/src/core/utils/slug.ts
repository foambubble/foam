import GithubSlugger from 'github-slugger';
import { URI } from '../model/uri';
import { getName } from '../utils/path';

export const uriToSlug = (uri: URI): string =>
  GithubSlugger.slug(getName(uri.path));
