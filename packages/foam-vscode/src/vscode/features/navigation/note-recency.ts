import { URI } from '@foam/core';

/** Notes remembered before the oldest is forgotten. */
const DEFAULT_LIMIT = 50;

/** Fragment and query point into a note, not at a different one. */
const keyOf = (uri: URI) => uri.asPlain().toString();

/**
 * The notes the user has been on, most recent first.
 *
 * `Go to Note` orders by this so the picker opens on what the user was just
 * reading, the way `Go to File` opens on recently used editors, rather than
 * alphabetically from the top of the workspace.
 */
export class NoteRecency {
  private keys: string[] = [];

  constructor(private readonly limit: number = DEFAULT_LIMIT) {}

  /** Records that the user is on this note, making it the most recent. */
  visit(uri: URI): void {
    const key = keyOf(uri);
    this.keys = [key, ...this.keys.filter(k => k !== key)].slice(0, this.limit);
  }

  /**
   * How recently the note was visited — 0 for the most recent. A note that was
   * never visited, or was visited beyond the limit, ranks behind every note
   * that was, and ties with the rest so their own order is left alone.
   */
  rank(uri: URI): number {
    const index = this.keys.indexOf(keyOf(uri));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  }
}
