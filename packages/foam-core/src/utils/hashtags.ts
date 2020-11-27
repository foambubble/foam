import { isSome, isNumeric } from './core';
const HASHTAG_REGEX = /(^|[ ])#([\w_-]*[a-zA-Z][\w_-]*\b)/gm;
const WORD_REGEX = /(^|[ ])([\w_-]*[a-zA-Z][\w_-]*\b)/gm;

export const extractHashtags = (text: string): Set<string> => {
  return isSome(text)
    ? new Set(Array.from(text.matchAll(HASHTAG_REGEX), m => m[2].trim()))
    : new Set();
};

export const extractTagsFromProp = (prop: string | string[]): Set<string> => {
  const text = Array.isArray(prop) ? prop.join(' ') : prop;
  return isSome(text)
    ? new Set(Array.from(text.matchAll(WORD_REGEX)).map(m => m[2].trim()))
    : new Set();
};
