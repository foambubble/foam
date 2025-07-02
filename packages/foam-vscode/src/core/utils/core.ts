import sha1 from 'js-sha1';

/**
 * Checks if a value is not null.
 *
 * @param value - The value to check.
 * @returns True if the value is not null, otherwise false.
 */
export function isNotNull<T>(value: T | null): value is T {
  return value != null;
}

/**
 * Checks if a value is not null, undefined, or void.
 *
 * @param value - The value to check.
 * @returns True if the value is not null, undefined, or void, otherwise false.
 */
export function isSome<T>(
  value: T | null | undefined | void
): value is NonNullable<T> {
  return value != null;
}

/**
 * Checks if a value is null, undefined, or void.
 *
 * @param value - The value to check.
 * @returns True if the value is null, undefined, or void, otherwise false.
 */
export function isNone<T>(
  value: T | null | undefined | void
): value is null | undefined | void {
  return value == null;
}

/**
 * Checks if a string is numeric.
 *
 * @param value - The string to check.
 * @returns True if the string is numeric, otherwise false.
 */
export function isNumeric(value: string): boolean {
  return /-?\d+$/.test(value);
}

/**
 * Generates a SHA-1 hash of the given text.
 *
 * @param text - The text to hash.
 * @returns The SHA-1 hash of the text.
 */
export const hash = (text: string) => sha1.sha1(text);

/**
 * Executes an array of functions and returns the first result that satisfies the predicate.
 *
 * @param functions - The array of functions to execute.
 * @param predicate - The predicate to test the results. Defaults to checking if the result is not null.
 * @returns The first result that satisfies the predicate, or undefined if no result satisfies the predicate.
 */
export async function firstFrom<T>(
  functions: Array<() => T | Promise<T>>,
  predicate: (result: T) => boolean = result => result != null
): Promise<T | undefined> {
  for (const fn of functions) {
    const result = await fn();
    if (predicate(result)) {
      return result;
    }
  }
  return undefined;
}

/**
 * Lazily executes an array of functions and yields their results.
 *
 * @param functions - The array of functions to execute.
 * @returns A generator yielding the results of the functions.
 */
function* lazyExecutor<T>(functions: Array<() => T>): Generator<T> {
  for (const fn of functions) {
    yield fn();
  }
}
