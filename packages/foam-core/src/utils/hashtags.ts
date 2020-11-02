import { isSome } from './index';

const HASHTAG_REGEX = /(^|\W|\/)#([\w_-]+\b)/gm;
const WORD_REGEX = /(^|\W|\/)([\w_-]+\b)/gm;

export const extractHashtags = (text: string): Set<string> => {
  return isSome(text)
    ? new Set(
        Array.from(text.matchAll(HASHTAG_REGEX), m => m[2])
          .map(tag => tag.trim())
          .filter(tag => !isNumeric(tag))
      )
    : new Set();
};

export const extractTagsFromProp = (prop: string | string[]): Set<string> => {
  const text = Array.isArray(prop) ? prop.join(' ') : prop;
  return isSome(text)
    ? new Set(Array.from(text.matchAll(WORD_REGEX), m => m[2]))
    : new Set();
};

const isNumeric = (value: string): boolean => {
  return /-?\d+$/.test(value);
};
