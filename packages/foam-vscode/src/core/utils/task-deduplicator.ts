/**
 * A utility class for deduplicating concurrent async operations.
 * When multiple calls are made while a task is running, subsequent calls
 * will wait for and receive the result of the already-running task instead
 * of starting a new one.
 *
 * @example
 * const deduplicator = new TaskDeduplicator<string>();
 *
 * async function expensiveOperation(input: string): Promise<string> {
 *   return deduplicator.run(async () => {
 *     // Expensive work here
 *     return result;
 *   });
 * }
 *
 * // Multiple concurrent calls will share the same execution
 * const [result1, result2] = await Promise.all([
 *   expensiveOperation("test"),
 *   expensiveOperation("test"),
 * ]);
 * // Only runs once, both get the same result
 */
export class TaskDeduplicator<T> {
  private runningTask: Promise<T> | null = null;

  /**
   * Run a task with deduplication.
   * If a task is already running, waits for it to complete and returns its result.
   * Otherwise, starts the task and stores its promise for other callers to await.
   *
   * @param task The async function to execute
   * @param onDuplicate Optional callback when a duplicate call is detected
   * @returns The result of the task
   */
  async run(task: () => Promise<T>, onDuplicate?: () => void): Promise<T> {
    // If already running, wait for the existing task
    if (this.runningTask) {
      onDuplicate?.();
      return await this.runningTask;
    }

    // Start the task and store the promise
    this.runningTask = task();

    try {
      return await this.runningTask;
    } finally {
      // Clear the task when done
      this.runningTask = null;
    }
  }

  /**
   * Check if a task is currently running
   */
  isRunning(): boolean {
    return this.runningTask !== null;
  }

  /**
   * Clear the running task reference (useful for testing or error recovery)
   */
  clear(): void {
    this.runningTask = null;
  }
}
