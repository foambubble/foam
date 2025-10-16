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
