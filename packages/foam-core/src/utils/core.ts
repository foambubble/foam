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
export function isSome<T>(value: T | null | undefined | void): value is NonNullable<T> {
  return value != null;
}

/**
 * Checks if a value is null, undefined, or void.
 *
 * @param value - The value to check.
 * @returns True if the value is null, undefined, or void, otherwise false.
 */
export function isNone<T>(value: T | null | undefined | void): value is null | undefined | void {
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
export function* lazyExecutor<T>(functions: Array<() => T>): Generator<T> {
  for (const fn of functions) {
    yield fn();
  }
}

/**
 * Runs an async task for each item with a bounded concurrency.
 *
 * Without a cap, `Promise.all(items.map(fn))` schedules every task at once.
 * For I/O-heavy tasks like reading file contents this can hold the bytes of
 * every file resident in memory simultaneously, which on large workspaces
 * exhausts the V8 external-memory budget (see issue #1167).
 *
 * @param items - the items to process
 * @param limit - the maximum number of tasks running concurrently
 * @param fn - the async task to run per item
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number = 256,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (limit <= 0) {
    throw new Error(`mapWithConcurrency: limit must be > 0, got ${limit}`);
  }
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
