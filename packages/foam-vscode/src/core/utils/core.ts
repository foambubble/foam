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
