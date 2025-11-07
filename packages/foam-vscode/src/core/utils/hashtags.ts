import { isSome } from './core';
export const HASHTAG_REGEX =
  /(?<=^|\s)#([0-9]*(?:[\p{L}\p{Extended_Pictographic}/_-]|\uFE0F|\p{Emoji_Modifier})(?:[\p{L}\p{Extended_Pictographic}\p{N}/_-]|\uFE0F|\p{Emoji_Modifier})*)/gmu;
export const WORD_REGEX =
  /(?<=^|\s)([0-9]*(?:[\p{L}\p{Extended_Pictographic}/_-]|\uFE0F|\p{Emoji_Modifier})(?:[\p{L}\p{Extended_Pictographic}\p{N}/_-]|\uFE0F|\p{Emoji_Modifier})*)/gmu;

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
