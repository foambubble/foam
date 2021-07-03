import { isSome } from './core';
import { ignoreCode } from '../markdown-provider';

const HASHTAG_REGEX = /(^|\s)#([0-9]*[\p{L}/_-][\p{L}\p{N}/_-]*)/gmu;
const WORD_REGEX = /(^|\s)([0-9]*[\p{L}/_-][\p{L}\p{N}/_-]*)/gmu;

export const extractHashtags = (text: string): Set<string> => {
  const textOutOfCode = ignoreCode(text);
  return isSome(textOutOfCode)
    ? new Set(
        Array.from(textOutOfCode.matchAll(HASHTAG_REGEX), m => m[2].trim())
      )
    : new Set();
};

export const extractTagsFromProp = (prop: string | string[]): Set<string> => {
  const text = Array.isArray(prop) ? prop.join(' ') : prop;
  return isSome(text)
    ? new Set(Array.from(text.matchAll(WORD_REGEX)).map(m => m[2].trim()))
    : new Set();
};
