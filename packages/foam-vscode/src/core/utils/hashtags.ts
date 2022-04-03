import { isSome } from './core';
const HASHTAG_REGEX = /(?<=^|\s)#([0-9]*[\p{L}/_-][\p{L}\p{N}/_-]*)/gmu;
const WORD_REGEX = /(?<=^|\s)([0-9]*[\p{L}/_-][\p{L}\p{N}/_-]*)/gmu;
// https://stackoverflow.com/a/67705964
const EMOJI_HASHTAG_REGEX = /(?<=^|\s)#(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/gm;
const EMOJI_REGEX = /(?<=^|\s)(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/gm;

export const extractHashtags = (
  text: string
): Array<{ label: string; offset: number }> => {
  const hashtagMatches = Array.from(text.matchAll(HASHTAG_REGEX));
  const emojiHashtagMatches = Array.from(text.matchAll(EMOJI_HASHTAG_REGEX));
  return isSome(text)
    ? hashtagMatches.concat(emojiHashtagMatches).map(m => ({
        label: m[1],
        offset: m.index!,
      }))
    : [];
};

export const extractTagsFromProp = (prop: string | string[]): string[] => {
  const text = Array.isArray(prop) ? prop.join(' ') : prop;
  const wordMatches = Array.from(text.matchAll(WORD_REGEX));
  const emojiMatches = Array.from(text.matchAll(EMOJI_REGEX));
  return isSome(text) ? wordMatches.concat(emojiMatches).map(m => m[1]) : [];
};
