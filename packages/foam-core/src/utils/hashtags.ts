import { isSome, isNumeric } from './core';
import matchAll from 'string.prototype.matchall';

const HASHTAG_REGEX = /(^|[ ])#([\w_-]+\b)/gm;
const WORD_REGEX = /(^|[ ])([\w_-]+\b)/gm;

export const extractHashtags = (text: string): Set<string> => {
  return isSome(text)
    ? new Set(
        Array.from(matchAll(text, HASHTAG_REGEX))
          .map(m => m[2].trim())
          .filter(tag => !isNumeric(tag))
      )
    : new Set();
};

export const extractTagsFromProp = (prop: string | string[]): Set<string> => {
  const text = Array.isArray(prop) ? prop.join(' ') : prop;
  return isSome(text)
    ? new Set(Array.from(matchAll(text, WORD_REGEX)).map(m => m[2].trim()))
    : new Set();
};
