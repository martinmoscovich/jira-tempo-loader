import { describe, expect, it, vi } from 'vitest';
import { ErrorDecision, runParallelQueues } from './parallelQueues';

class RateLimited extends Error {
  constructor(public delayMs?: number) {
    super('429');
  }
}
class Fatal extends Error {}
class Rejected extends Error {}

const classify = (error: unknown): ErrorDecision => {
  if (error instanceof RateLimited) return { action: 'retry', delayMs: error.delayMs };
  if (error instanceof Fatal) return { action: 'abort', message: 'session lost' };
  return { action: 'fail', message: (error as Error).message };
};

/** Virtual clock: sleep advances time instantly, so waits are observable but tests stay fast. */
const createClock = () => {
  let time = 0;
  const sleeps: number[] = [];
  return {
    now: () => time,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      time += ms;
      await Promise.resolve();
    },
    sleeps,
  };
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('runParallelQueues', () => {
  it('processes every item with at most N requests in flight', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const done: number[] = [];

    const result = await runParallelQueues([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {
      concurrency: 3,
      classifyError: classify,
      process: async (item) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await tick();
        inFlight--;
        done.push(item);
      },
    });

    expect(maxInFlight).toBe(3);
    expect(done.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result).toMatchObject({ succeeded: 10, failed: 0, notStarted: 0, stopped: false });
  });

  // A 429 applies to the whole session: one rate-limited worker must hold back all the others.
  it('pauses all workers when one is rate limited, honoring the server delay', async () => {
    vi.useFakeTimers();
    try {
      const start = Date.now();
      const sendTimes: Record<string, number[]> = {};
      let limited = false;

      const run = runParallelQueues(['a', 'b', 'c', 'd'], {
        concurrency: 2,
        classifyError: classify,
        process: async (item) => {
          (sendTimes[item] ??= []).push(Date.now() - start);
          await new Promise((resolve) => setTimeout(resolve, item === 'b' ? 100 : 10));
          if (item === 'a' && !limited) {
            limited = true;
            throw new RateLimited(5000);
          }
        },
      });
      await vi.runAllTimersAsync();
      await run;

      // 'a' got a 429 at 10ms and is retried 5s later. 'b' finishes at 100ms, while the gate is
      // closed, so the next item that worker picks ('c') must also wait until the gate opens.
      expect(sendTimes.a).toEqual([0, 5010]);
      expect(sendTimes.c[0]).toBeGreaterThanOrEqual(5010);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses exponential backoff when the server gives no delay', async () => {
    const clock = createClock();
    let calls = 0;

    const result = await runParallelQueues(['x'], {
      concurrency: 1,
      classifyError: classify,
      baseDelayMs: 1000,
      random: () => 0.5, // no jitter
      now: clock.now,
      sleep: clock.sleep,
      process: async () => {
        calls++;
        if (calls <= 3) throw new RateLimited();
      },
    });

    expect(clock.sleeps).toEqual([1000, 2000, 4000]);
    expect(result.succeeded).toBe(1);
  });

  it('marks the item as failed once retries are exhausted and continues with the rest', async () => {
    const clock = createClock();
    const onFailure = vi.fn();

    const result = await runParallelQueues(['bad', 'good'], {
      concurrency: 1,
      classifyError: classify,
      maxRetries: 2,
      now: clock.now,
      sleep: clock.sleep,
      onFailure,
      process: async (item) => {
        if (item === 'bad') throw new RateLimited(10);
      },
    });

    expect(onFailure).toHaveBeenCalledWith('bad', 'Gave up after 2 retries');
    expect(result).toMatchObject({ succeeded: 1, failed: 1 });
  });

  it('fails a non-retryable item immediately without retrying it', async () => {
    const process = vi.fn(async (item: string) => {
      if (item === 'bad') throw new Rejected('Issue does not exist');
    });
    const onFailure = vi.fn();

    const result = await runParallelQueues(['bad', 'good'], {
      concurrency: 2,
      classifyError: classify,
      process,
      onFailure,
    });

    expect(process).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledWith('bad', 'Issue does not exist');
    expect(result).toMatchObject({ succeeded: 1, failed: 1 });
  });

  it('stops every worker on an abort decision', async () => {
    const processed: number[] = [];

    const result = await runParallelQueues([1, 2, 3, 4, 5, 6], {
      concurrency: 2,
      classifyError: classify,
      process: async (item) => {
        processed.push(item);
        await tick();
        if (item === 1) throw new Fatal('401');
      },
    });

    expect(result.abortMessage).toBe('session lost');
    expect(processed.length).toBeLessThanOrEqual(3);
    expect(result.notStarted).toBeGreaterThan(0);
  });

  it('on pause, stops taking new items and returns a waiting item to the queue', async () => {
    const clock = createClock();
    let paused = false;
    const onRequeue = vi.fn();

    const result = await runParallelQueues(['a', 'b', 'c'], {
      concurrency: 1,
      classifyError: classify,
      now: clock.now,
      sleep: async (ms) => {
        paused = true; // user pauses while the worker waits out a rate limit
        await clock.sleep(ms);
      },
      shouldStop: () => paused,
      onRequeue,
      process: async () => {
        throw new RateLimited(1000);
      },
    });

    expect(onRequeue).toHaveBeenCalledWith('a');
    expect(result).toMatchObject({ succeeded: 0, failed: 0, requeued: 1, notStarted: 2, stopped: true });
  });
});
