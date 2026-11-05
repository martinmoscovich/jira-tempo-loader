/**
 * Runs items through N parallel workers that pull from one shared queue, so a worker never sits
 * idle while another still has a backlog (unlike splitting the list into N fixed chunks).
 *
 * Errors are classified per item by the caller:
 * - `retry`: nothing was written; wait and try the same item again. The wait is shared by all
 *   workers, because a rate limit (429) applies to the whole session, not to one request.
 * - `fail`: give up on this item and continue with the rest.
 * - `abort`: stop every worker (e.g. the session is gone).
 */
export type ErrorDecision =
  | { action: 'retry'; delayMs?: number }
  | { action: 'fail'; message: string }
  | { action: 'abort'; message: string };

export interface ParallelQueueOptions<T> {
  concurrency: number;
  process: (item: T) => Promise<void>;
  classifyError: (error: unknown) => ErrorDecision;
  /** Retries per item before it is marked as failed. */
  maxRetries?: number;
  /** First backoff delay when the server gives no explicit wait; doubles on each retry. */
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Checked before each item and after each wait (pause support). */
  shouldStop?: () => boolean;
  onStart?: (item: T) => void;
  onSuccess?: (item: T) => void;
  onFailure?: (item: T, message: string) => void;
  /** The item was started but not finished because the run stopped while it was waiting. */
  onRequeue?: (item: T) => void;
  /** All workers are paused until this timestamp (ms). */
  onWait?: (untilMs: number) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

export interface ParallelQueueResult {
  succeeded: number;
  failed: number;
  requeued: number;
  /** Items never started because the run stopped or aborted. */
  notStarted: number;
  stopped: boolean;
  abortMessage?: string;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runParallelQueues<T>(
  items: readonly T[],
  options: ParallelQueueOptions<T>
): Promise<ParallelQueueResult> {
  const {
    concurrency,
    process,
    classifyError,
    maxRetries = 4,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    shouldStop = () => false,
    onStart,
    onSuccess,
    onFailure,
    onRequeue,
    onWait,
    sleep = defaultSleep,
    now = Date.now,
    random = Math.random,
  } = options;

  const queue = [...items];
  const result = { succeeded: 0, failed: 0, requeued: 0 };
  let abortMessage: string | undefined;
  // Shared gate: while now() < blockedUntil no worker sends a request.
  let blockedUntil = 0;

  const isHalted = () => abortMessage !== undefined || shouldStop();

  const waitForGate = async () => {
    while (now() < blockedUntil) {
      await sleep(blockedUntil - now());
    }
  };

  const backoffDelay = (attempt: number) => {
    const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    // +-25% jitter so parallel workers don't all retry at the same instant.
    return Math.round(exponential * (0.75 + random() * 0.5));
  };

  const fail = (item: T, message: string) => {
    result.failed++;
    onFailure?.(item, message);
  };

  const handleItem = async (item: T) => {
    onStart?.(item);

    for (let attempt = 0; ; attempt++) {
      await waitForGate();
      if (isHalted()) {
        result.requeued++;
        onRequeue?.(item);
        return;
      }

      try {
        await process(item);
        result.succeeded++;
        onSuccess?.(item);
        return;
      } catch (error) {
        const decision = classifyError(error);

        if (decision.action === 'abort') {
          abortMessage ??= decision.message;
          fail(item, decision.message);
          return;
        }
        if (decision.action === 'fail') {
          fail(item, decision.message);
          return;
        }
        if (attempt >= maxRetries) {
          fail(item, `Gave up after ${maxRetries} retries`);
          return;
        }

        const delay = decision.delayMs ?? backoffDelay(attempt);
        blockedUntil = Math.max(blockedUntil, now() + delay);
        onWait?.(blockedUntil);
      }
    }
  };

  const worker = async () => {
    while (queue.length > 0 && !isHalted()) {
      await handleItem(queue.shift() as T);
    }
  };

  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), queue.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  return {
    ...result,
    notStarted: queue.length,
    stopped: abortMessage === undefined && shouldStop(),
    abortMessage,
  };
}
