import { isSome } from './core';
const HASHTAG_REGEX = /(?<=^|\s)#([0-9]*[\p{L}/_-][\p{L}\p{N}/_-]*)/gmu;
const WORD_REGEX = /(?<=^|\s)([0-9]*[\p{L}/_-][\p{L}\p{N}/_-]*)/gmu;

export const extractHashtags = (
  text: string
): Array<{ label: string; offset: number }> => {
  return isSome(text)
    ? Array.from(text.matchAll(HASHTAG_REGEX)).map(m => ({
        label: m[1],
        offset: m.index!,
      }))
    : [];
};

export const extractTagsFromProp = (prop: string | string[]): string[] => {
  const text = Array.isArray(prop) ? prop.join(' ') : prop;
  return isSome(text)
    ? Array.from(text.matchAll(WORD_REGEX)).map(m => m[1])
    : [];
};
