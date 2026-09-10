/** Global resource budgets. One source for main + renderer: every unbounded
 *  growth surface (terminal scrollback, feed rings, queues, log reads) caps
 *  here. Numbers are generous, not tight — the point is a ceiling exists. */

/** xterm scrollback lines per terminal (was 100k ≈ 50-100MB/agent under TUI churn). */
export const SCROLLBACK_MAX = 20_000;
/** Activity feed lines retained per agent. */
export const FEED_MAX = 500;
/** Queued messages retained per agent (oldest dropped, warned). */
export const QUEUE_MAX = 50;
/** log.jsonl read window per tail call (was: whole file parsed per call). */
export const LOG_TAIL_BYTES = 512 * 1024;

/** Keep the last n items (ring-buffer append). Pure, tested. */
export function capTail<T>(arr: readonly T[], n: number): T[] {
  if (arr.length <= n) return arr.slice();
  return arr.slice(arr.length - n);
}
