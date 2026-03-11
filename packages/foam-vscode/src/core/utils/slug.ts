import slugger from 'github-slugger';

export const toSlug = (s: string) => slugger.slug(s);
