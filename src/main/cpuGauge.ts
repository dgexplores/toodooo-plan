/**
 * Aggregate CPU gauge (R-13, upstream #471): cap total CPU across the agent
 * process TREES, not just the direct children — an agent's cost is its tools.
 * POSIX: one `ps` snapshot → parent map → subtree sums. Windows: unsupported
 * (no cheap tree-%CPU source; wmic deprecated, CIM heavy) — returns null and
 * the gate stays open, loudly logged once. Pure + tested; sampling/scheduling
 *  lives with the caller.
 */
import { spawnSync } from 'node:child_process';

export interface CpuSample {
  pid: number;
  ppid: number;
  pct: number;
}

/** Parse `ps -o pid=,ppid=,pcpu= -ax` output. Tolerates headers + junk lines. */
export function parsePs(output: string): CpuSample[] {
  const out: CpuSample[] = [];
  for (const line of output.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const pid = Number(parts[0]);
    const ppid = Number(parts[1]);
    const pct = Number(parts[2]);
    if (!Number.isFinite(pid) || !Number.isFinite(ppid) || !Number.isFinite(pct)) continue;
    out.push({ pid, ppid, pct });
  }
  return out;
}

/** Sum %CPU over each root's whole subtree (children, grandchildren…). */
export function subtreeSums(samples: CpuSample[], roots: readonly number[]): Map<number, number> {
  const kids = new Map<number, number[]>();
  const pct = new Map<number, number>();
  for (const s of samples) {
    pct.set(s.pid, s.pct);
    const list = kids.get(s.ppid) ?? [];
    list.push(s.pid);
    kids.set(s.ppid, list);
  }
  const result = new Map<number, number>();
  const visiting = new Set<number>();
  const sum = (pid: number): number => {
    if (visiting.has(pid)) return 0; // pid-reuse cycle guard
    visiting.add(pid);
    let total = pct.get(pid) ?? 0;
    for (const kid of kids.get(pid) ?? []) total += sum(kid);
    visiting.delete(pid);
    return total;
  };
  for (const r of roots) result.set(r, sum(r));
  return result;
}

/** Floor total across all agent trees: UNION of pids (a shared subtree counts
 *  once no matter how many roots cover it — the cap measures machine load). */
export function floorCpuPct(samples: CpuSample[], roots: readonly number[]): number {
  const kids = new Map<number, number[]>();
  const pct = new Map<number, number>();
  for (const s of samples) {
    pct.set(s.pid, s.pct);
    const list = kids.get(s.ppid) ?? [];
    list.push(s.pid);
    kids.set(s.ppid, list);
  }
  const seen = new Set<number>();
  const stack = [...roots];
  let total = 0;
  while (stack.length > 0) {
    const pid = stack.pop()!;
    if (seen.has(pid)) continue;
    seen.add(pid);
    total += pct.get(pid) ?? 0;
    for (const kid of kids.get(pid) ?? []) stack.push(kid);
  }
  return total;
}

const PS_TIMEOUT_MS = 3000;

/** One synchronous `ps` snapshot summed over the given roots. Sync by design:
 *  direct exec, no shell init (~10-50ms), called only on spawn (human-paced).
 *  Null on Windows (unsupported) or any failure — the gate stays open. */
export function sampleFloorCpu(roots: readonly number[]): number | null {
  if (process.platform === 'win32' || roots.length === 0) return null;
  try {
    const res = spawnSync('ps', ['-o', 'pid=,ppid=,pcpu=', '-ax'], { encoding: 'utf8', timeout: PS_TIMEOUT_MS });
    if (res.error || typeof res.stdout !== 'string') return null;
    return floorCpuPct(parsePs(res.stdout), roots);
  } catch {
    return null;
  }
}
