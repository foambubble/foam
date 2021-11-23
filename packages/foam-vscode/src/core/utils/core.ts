import crypto from 'crypto';

export function isNotNull<T>(value: T | null): value is T {
  return value != null; // eslint-disable-line
}

export function isSome<T>(
  value: T | null | undefined | void
): value is NonNullable<T> {
  return value != null; // eslint-disable-line
}

export function isNone<T>(
  value: T | null | undefined | void
): value is null | undefined | void {
  return value == null; // eslint-disable-line
}

export function isNumeric(value: string): boolean {
  return /-?\d+$/.test(value);
}

export const hash = (text: string) =>
  crypto
    .createHash('sha1')
    .update(text)
    .digest('hex');

/**
 * Returns the minimal identifier for the given string amongst others
 *
 * @param forValue the value to compute the identifier for
 * @param amongst the set of strings within which to find the identifier
 */
export const getShortestIdentifier = (
  forValue: string,
  amongst: string[]
): string => {
  const needleTokens = forValue.split('/').reverse();
  const haystack = amongst
    .filter(value => value !== forValue)
    .map(value => value.split('/').reverse());

  let tokenIndex = 0;
  let res = needleTokens;
  while (tokenIndex < needleTokens.length) {
    for (let j = haystack.length - 1; j >= 0; j--) {
      if (
        haystack[j].length < tokenIndex ||
        needleTokens[tokenIndex] !== haystack[j][tokenIndex]
      ) {
        haystack.splice(j, 1);
      }
    }
    if (haystack.length === 0) {
      res = needleTokens.splice(0, tokenIndex + 1);
      break;
    }
    tokenIndex++;
  }
  const identifier = res
    .filter(token => token.trim() !== '')
    .reverse()
    .join('/');

  return identifier;
};
