import { describe, expect, it, vi } from 'vitest';
import { mapWithConcurrency } from './core';

describe('mapWithConcurrency', () => {
  it('returns results in input order', async () => {
    const items = [10, 20, 30, 40, 50];
    const results = await mapWithConcurrency(items, 2, async n => n * 2);
    expect(results).toEqual([20, 40, 60, 80, 100]);
  });

  it('handles an empty input', async () => {
    const fn = vi.fn(async (n: number) => n);
    const results = await mapWithConcurrency([], 4, fn);
    expect(results).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('never exceeds the concurrency limit', async () => {
    const limit = 3;
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);

    await mapWithConcurrency(items, limit, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight--;
    });

    expect(peak).toBeLessThanOrEqual(limit);
    expect(peak).toBeGreaterThan(1);
  });

  it('processes all items even when there are more than the limit', async () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const seen = new Set<number>();
    await mapWithConcurrency(items, 5, async n => {
      seen.add(n);
    });
    expect(seen.size).toBe(100);
  });

  it('rejects when the limit is not positive', async () => {
    await expect(mapWithConcurrency([1], 0, async n => n)).rejects.toThrow(
      /limit must be > 0/
    );
  });

  it('propagates errors from the task', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async n => {
        if (n === 2) throw new Error('boom');
        return n;
      })
    ).rejects.toThrow('boom');
  });
});
