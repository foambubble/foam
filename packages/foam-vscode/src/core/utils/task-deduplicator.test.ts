import { TaskDeduplicator } from './task-deduplicator';

describe('TaskDeduplicator', () => {
  describe('run', () => {
    it('should execute a task and return its result', async () => {
      const deduplicator = new TaskDeduplicator<string>();
      const task = jest.fn(async () => 'result');

      const result = await deduplicator.run(task);

      expect(result).toBe('result');
      expect(task).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent calls to the same task', async () => {
      const deduplicator = new TaskDeduplicator<string>();
      let executeCount = 0;

      const task = async () => {
        executeCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      // Start multiple concurrent calls
      const [result1, result2, result3] = await Promise.all([
        deduplicator.run(task),
        deduplicator.run(task),
        deduplicator.run(task),
      ]);

      // All should get the same result
      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(result3).toBe('result');

      // Task should only execute once
      expect(executeCount).toBe(1);
    });

    it('should call onDuplicate callback for concurrent calls', async () => {
      const deduplicator = new TaskDeduplicator<string>();
      const onDuplicate = jest.fn();

      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      // Start concurrent calls
      const promise1 = deduplicator.run(task);
      const promise2 = deduplicator.run(task, onDuplicate);
      const promise3 = deduplicator.run(task, onDuplicate);

      await Promise.all([promise1, promise2, promise3]);

      // onDuplicate should be called for the 2nd and 3rd calls
      expect(onDuplicate).toHaveBeenCalledTimes(2);
    });

    it('should not call onDuplicate for the first call', async () => {
      const deduplicator = new TaskDeduplicator<string>();
      const onDuplicate = jest.fn();
      const task = jest.fn(async () => 'result');

      await deduplicator.run(task, onDuplicate);

      expect(onDuplicate).not.toHaveBeenCalled();
    });

    it('should allow new tasks after previous task completes', async () => {
      const deduplicator = new TaskDeduplicator<number>();
      let counter = 0;

      const task1 = async () => ++counter;
      const task2 = async () => ++counter;

      const result1 = await deduplicator.run(task1);
      const result2 = await deduplicator.run(task2);

      expect(result1).toBe(1);
      expect(result2).toBe(2);
    });

    it('should propagate errors from the task', async () => {
      const deduplicator = new TaskDeduplicator<string>();
      const error = new Error('Task failed');
      const task = jest.fn(async () => {
        throw error;
      });

      await expect(deduplicator.run(task)).rejects.toThrow('Task failed');
    });

    it('should propagate errors to all concurrent callers', async () => {
      const deduplicator = new TaskDeduplicator<string>();
      const error = new Error('Task failed');

      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw error;
      };

      const promise1 = deduplicator.run(task);
      const promise2 = deduplicator.run(task);
      const promise3 = deduplicator.run(task);

      await expect(promise1).rejects.toThrow('Task failed');
      await expect(promise2).rejects.toThrow('Task failed');
      await expect(promise3).rejects.toThrow('Task failed');
    });

    it('should clear running task after error', async () => {
      const deduplicator = new TaskDeduplicator<string>();
      const task1 = jest.fn(async () => {
        throw new Error('Task failed');
      });
      const task2 = jest.fn(async () => 'success');

      // First task fails
      await expect(deduplicator.run(task1)).rejects.toThrow('Task failed');

      // Second task should execute (not deduplicated)
      const result = await deduplicator.run(task2);

      expect(result).toBe('success');
      expect(task1).toHaveBeenCalledTimes(1);
      expect(task2).toHaveBeenCalledTimes(1);
    });

    it('should handle different return types', async () => {
      // String
      const stringDeduplicator = new TaskDeduplicator<string>();
      const stringResult = await stringDeduplicator.run(async () => 'test');
      expect(stringResult).toBe('test');

      // Number
      const numberDeduplicator = new TaskDeduplicator<number>();
      const numberResult = await numberDeduplicator.run(async () => 42);
      expect(numberResult).toBe(42);

      // Object
      const objectDeduplicator = new TaskDeduplicator<{ value: string }>();
      const objectResult = await objectDeduplicator.run(async () => ({
        value: 'test',
      }));
      expect(objectResult).toEqual({ value: 'test' });

      // Union types
      type Status = 'complete' | 'cancelled' | 'error';
      const statusDeduplicator = new TaskDeduplicator<Status>();
      const statusResult = await statusDeduplicator.run(
        async () => 'complete' as Status
      );
      expect(statusResult).toBe('complete');
    });
  });

  describe('isRunning', () => {
    it('should return false when no task is running', () => {
      const deduplicator = new TaskDeduplicator<string>();

      expect(deduplicator.isRunning()).toBe(false);
    });

    it('should return true when a task is running', async () => {
      const deduplicator = new TaskDeduplicator<string>();

      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      const promise = deduplicator.run(task);

      expect(deduplicator.isRunning()).toBe(true);

      await promise;
    });

    it('should return false after task completes', async () => {
      const deduplicator = new TaskDeduplicator<string>();
      const task = jest.fn(async () => 'result');

      await deduplicator.run(task);

      expect(deduplicator.isRunning()).toBe(false);
    });

    it('should return false after task fails', async () => {
      const deduplicator = new TaskDeduplicator<string>();
      const task = jest.fn(async () => {
        throw new Error('Failed');
      });

      await expect(deduplicator.run(task)).rejects.toThrow('Failed');

      expect(deduplicator.isRunning()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear the running task reference', async () => {
      const deduplicator = new TaskDeduplicator<string>();

      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      const promise = deduplicator.run(task);

      expect(deduplicator.isRunning()).toBe(true);

      deduplicator.clear();

      expect(deduplicator.isRunning()).toBe(false);

      // Original promise should still complete
      await expect(promise).resolves.toBe('result');
    });

    it('should allow new task after manual clear', async () => {
      const deduplicator = new TaskDeduplicator<string>();
      let executeCount = 0;

      const task = async () => {
        executeCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'result';
      };

      // Start first task
      const promise1 = deduplicator.run(task);

      // Clear while still running
      deduplicator.clear();

      // Start second task (should not be deduplicated)
      const promise2 = deduplicator.run(task);

      await Promise.all([promise1, promise2]);

      // Both tasks should have executed
      expect(executeCount).toBe(2);
    });

    it('should be safe to call when no task is running', () => {
      const deduplicator = new TaskDeduplicator<string>();

      expect(() => deduplicator.clear()).not.toThrow();
      expect(deduplicator.isRunning()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle tasks that resolve immediately', async () => {
      const deduplicator = new TaskDeduplicator<string>();
      const task = jest.fn(async () => 'immediate');

      const result = await deduplicator.run(task);

      expect(result).toBe('immediate');
      expect(deduplicator.isRunning()).toBe(false);
    });

    it('should handle tasks that throw synchronously', async () => {
      const deduplicator = new TaskDeduplicator<string>();
      const task = jest.fn(() => {
        throw new Error('Sync error');
      });

      await expect(deduplicator.run(task as any)).rejects.toThrow('Sync error');
      expect(deduplicator.isRunning()).toBe(false);
    });

    it('should handle null/undefined results', async () => {
      const nullDeduplicator = new TaskDeduplicator<null>();
      const nullResult = await nullDeduplicator.run(async () => null);
      expect(nullResult).toBeNull();

      const undefinedDeduplicator = new TaskDeduplicator<undefined>();
      const undefinedResult = await undefinedDeduplicator.run(
        async () => undefined
      );
      expect(undefinedResult).toBeUndefined();
    });

    it('should handle sequential calls with delays between them', async () => {
      const deduplicator = new TaskDeduplicator<number>();
      let counter = 0;

      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return ++counter;
      };

      const result1 = await deduplicator.run(task);
      await new Promise(resolve => setTimeout(resolve, 20));
      const result2 = await deduplicator.run(task);

      expect(result1).toBe(1);
      expect(result2).toBe(2);
    });
  });
});
