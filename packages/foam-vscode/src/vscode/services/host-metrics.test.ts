import { describe, expect, it } from 'vitest';
import { EventLoopMonitor, formatMemoryUsage } from './host-metrics';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Blocks the event loop for at least `ms`, the way a long parse does */
const block = (ms: number) => {
  const until = performance.now() + ms;
  while (performance.now() < until) {
    // spin
  }
};

describe('EventLoopMonitor', () => {
  it('reports no lag before it is started', () => {
    const monitor = new EventLoopMonitor();
    expect(monitor.maxLagMs).toEqual(0);
    expect(monitor.samples).toEqual(0);
  });

  it('samples the loop while it is running', async () => {
    const monitor = new EventLoopMonitor();
    monitor.start();
    await sleep(350);
    monitor.stop();

    expect(monitor.samples).toBeGreaterThan(0);
  });

  it('measures a synchronous block as lag', async () => {
    const monitor = new EventLoopMonitor();
    monitor.start();
    await sleep(120);
    block(500);
    await sleep(120);
    monitor.stop();

    // the timer scheduled during the block fires ~500ms late
    expect(monitor.maxLagMs).toBeGreaterThan(300);
    expect(monitor.totalLagMs).toBeGreaterThanOrEqual(monitor.maxLagMs);
  });

  it('stops sampling once stopped', async () => {
    const monitor = new EventLoopMonitor();
    monitor.start();
    await sleep(250);
    monitor.stop();

    const samplesAtStop = monitor.samples;
    await sleep(300);
    expect(monitor.samples).toEqual(samplesAtStop);
  });

  it('ignores a second start rather than sampling twice', async () => {
    const monitor = new EventLoopMonitor();
    monitor.start();
    monitor.start();
    await sleep(250);
    monitor.stop();
    const samplesAtStop = monitor.samples;

    await sleep(300);
    // a leaked second interval would keep incrementing after stop
    expect(monitor.samples).toEqual(samplesAtStop);
  });
});

describe('formatMemoryUsage', () => {
  it('reports heap usage when the host exposes it', () => {
    expect(formatMemoryUsage()).toMatch(
      /heapUsed \d+ MiB, heapTotal \d+ MiB, rss \d+ MiB/
    );
  });

  it('degrades gracefully where there is no process, as on the web host', () => {
    const original = globalThis.process;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process = undefined;
    try {
      expect(formatMemoryUsage()).toEqual('unavailable');
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).process = original;
    }
  });
});
