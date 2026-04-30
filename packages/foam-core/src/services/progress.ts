/**
 * Generic progress information for long-running operations
 */
export interface Progress<T = unknown> {
  /** Current item being processed (1-indexed) */
  current: number;
  /** Total number of items to process */
  total: number;
  /** Optional context data about the current item */
  context?: T;
}

/**
 * Callback for reporting progress during operations
 */
export type ProgressCallback<T = unknown> = (progress: Progress<T>) => void;

/**
 * Cancellation token for aborting long-running operations
 */
export interface CancellationToken {
  /** Whether cancellation has been requested */
  readonly isCancellationRequested: boolean;
}

/**
 * Exception thrown when an operation is cancelled
 */
export class CancellationError extends Error {
  constructor(message: string = 'Operation cancelled') {
    super(message);
    this.name = 'CancellationError';
  }
}
