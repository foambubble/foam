const HASHTAG_REGEX = /(^|\W)\#([\w_-]+\b)/gm;
const WORD_REGEX = /(^|\W)([\w_-]+\b)/gm;

export const extractHashtags = (text: string): Set<string> => {
  return new Set(Array.from(text.matchAll(HASHTAG_REGEX), m => m[2]));
}

export const extractTagsFromProp = (prop: string | string[]): Set<string> => {
  const text = Array.isArray(prop)
    ? prop.join(' ')
    : prop
  return new Set(Array.from(text.matchAll(WORD_REGEX), m => m[2]));
}
