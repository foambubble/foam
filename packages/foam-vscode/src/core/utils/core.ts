import sha1 from 'js-sha1';

export function isNotNull<T>(value: T | null): value is T {
  return value != null;
}

export function isSome<T>(
  value: T | null | undefined | void
): value is NonNullable<T> {
  return value != null;
}

export function isNone<T>(
  value: T | null | undefined | void
): value is null | undefined | void {
  return value == null;
}

export function isNumeric(value: string): boolean {
  return /-?\d+$/.test(value);
}

export const hash = (text: string) => sha1.sha1(text);
