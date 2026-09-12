import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/store/store';
import { PixelPanel } from './PixelPanel';
import { PixelBadge } from './PixelBadge';
import { PixelButton } from './PixelButton';
import { parseTasks, type HiveTask } from './TasksKanban';

/**
 * The boss PC: one employee's live status screen. Header Flips through the
 * team (‹ ›) without closing; a stat strip answers "how much done" at a
 * glance; two columns hold now+recent (live) beside list+done (ledger).
 * Deliberately NOT the terminal. Finish dates come from the ledger stamp —
 * old cards group as earlier, nothing claims a day it can't prove.
 */

const POLL_MS = 5000;
const stripAnsi = (s: string): string => s.replace(/\[[0-9;]*m/g, '');

/** Which day bucket a finish stamp falls in, in local time. Missing or
 *  unparseable stamps group as earlier — old cards predate the stamp. */
function dayBucket(iso: string | null | undefined, now = new Date()): 'today' | 'yesterday' | 'earlier' {
  if (!iso) return 'earlier';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'earlier';
  const day = (x: Date): string => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  if (day(d) === day(now)) return 'today';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return day(d) === day(y) ? 'yesterday' : 'earlier';
}

export function AgentPcOverlay() {
  const { t } = useTranslation();
  const pcAgentId = useStore((s) => s.pcAgentId);
  const closePc = useStore((s) => s.closePc);
  const openPc = useStore((s) => s.openPc);
  const openTaskDetail = useStore((s) => s.openTaskDetail);
  const agents = useStore((s) => s.agents);
  const agent = agents.find((a) => a.id === pcAgentId);
  const feed = useStore((s) => (pcAgentId ? (s.feeds[pcAgentId] ?? []) : []));
  const [tasks, setTasks] = useState<HiveTask[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try { setTasks(parseTasks(await window.cth.hiveTasks())); } catch { /* keep last good */ }
  }, []);

  useEffect(() => {
    if (!pcAgentId) return;
    void refresh();
    timer.current = setInterval(() => { void refresh(); }, POLL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [pcAgentId, refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePc();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const st = useStore.getState();
        const list = st.agents;
        const i = list.findIndex((a) => a.id === st.pcAgentId);
        if (i >= 0 && list.length > 1) {
          const n = e.key === 'ArrowRight'
            ? list[(i + 1) % list.length]
            : list[(i - 1 + list.length) % list.length];
          st.openPc(n.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePc]);

  if (!pcAgentId || !agent) return null;

  const mine = tasks.filter((x) => x.assignee === agent.id);
  const open = mine.filter((x) => x.status !== 'done');
  const done = mine.filter((x) => x.status === 'done');
  const doneToday = done.filter((x) => dayBucket(x.completedAt) === 'today');
  const doneYesterday = done.filter((x) => dayBucket(x.completedAt) === 'yesterday');
  const doneEarlier = done.filter((x) => dayBucket(x.completedAt) === 'earlier');
  const recent = feed.map(stripAnsi).filter((x) => x.trim()).slice(-8).reverse();
  const now = (agent.action || '').trim() || (agent.lastPrompt || '').trim().split(/\s+/).slice(0, 6).join(' ') || t('office.activity.idle');
  const idx = agents.findIndex((a) => a.id === agent.id);
  const ctxPct = agent.contextTokens !== undefined && agent.contextLimit
    ? Math.min(100, Math.round((agent.contextTokens / agent.contextLimit) * 100))
    : null;

  const openTask = (id: string) => { closePc(); openTaskDetail(id); };
  const flip = (dir: 1 | -1) => {
    if (agents.length < 2) return;
    openPc(agents[(idx + dir + agents.length) % agents.length].id);
  };

  return (
    <div
      onClick={closePc}
      style={{
        position: 'fixed', inset: 0, zIndex: 280,
        background: 'rgba(26, 19, 32, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 760, maxWidth: '96vw', maxHeight: '90vh', display: 'flex' }}>
        <PixelPanel variant="dialog" title={`${agent.name} — PC`} noPadding style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0 }}>
          {/* Header band: flip through the team without closing */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            background: 'var(--cth-cream-200)', boxShadow: 'inset 0 -1px 0 var(--cth-ink-300)'
          }}>
            <FlipBtn dir="‹" label={t('agentPc.prev')} onFlip={() => flip(-1)} />
            <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 12, color: 'var(--cth-ink-900)' }}>
              {agent.name.toUpperCase()}
            </span>
            <PixelBadge status={agent.status} />
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--cth-font-mono)', fontSize: 11, color: 'var(--cth-ink-500)' }}>
              {idx + 1} / {agents.length}
            </span>
            <FlipBtn dir="›" label={t('agentPc.next')} onFlip={() => flip(1)} />
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflowY: 'auto' }}>
            {/* Stat strip: how much done, how much open, live context */}
            <div style={{ display: 'flex', gap: 8 }}>
              <Stat label={t('agentPc.done')} value={String(done.length)} accent="var(--cth-mint)" />
              <Stat label={t('agentPc.list')} value={String(open.length)} accent="var(--cth-lemon)" />
              <div style={{
                flex: 1, padding: '6px 10px', background: 'var(--cth-paper-100)',
                boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
                display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center'
              }}>
                <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-ink-500)' }}>
                  {t('agentPc.context')}
                </span>
                {ctxPct !== null ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 8, background: 'var(--cth-cream-200)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }}>
                      <div style={{
                        width: `${ctxPct}%`, height: '100%',
                        background: ctxPct >= 88 ? 'var(--cth-coral)' : ctxPct >= 75 ? 'var(--cth-lemon)' : 'var(--cth-mint)'
                      }} />
                    </div>
                    <span style={{ fontFamily: 'var(--cth-font-mono)', fontSize: 11, color: 'var(--cth-ink-900)' }}>{ctxPct}%</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--cth-ink-300)' }}>{t('agentPc.noContext')}</span>
                )}
              </div>
            </div>

            {/* Two columns: live (now + recent) beside ledger (list + done) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                <PcSection title={t('agentPc.now')}>
                  <div style={{
                    padding: 8, background: 'var(--cth-paper-100)',
                    boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
                    fontFamily: 'var(--cth-font-ui)', fontSize: 13, color: 'var(--cth-ink-900)',
                    wordBreak: 'break-word'
                  }}>{now}</div>
                </PcSection>
                <PcSection title={t('agentPc.recent')} empty={recent.length === 0 ? t('agentPc.quiet') : null}>
                  <div style={{
                    padding: 8, background: 'var(--cth-ink-900)', color: 'var(--cth-cream-100)',
                    fontFamily: 'var(--cth-font-mono)', fontSize: 11, lineHeight: '16px',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                  }}>
                    {recent.join('\n')}
                  </div>
                </PcSection>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                <PcSection title={t('agentPc.list')} empty={open.length === 0 ? t('agentPc.allClear') : null}>
                  {open.map((x) => (
                    <PcTaskRow key={x.id} title={x.title} status={x.status} onOpen={() => openTask(x.id)} />
                  ))}
                </PcSection>
                <PcSection title={t('agentPc.done')} empty={done.length === 0 ? t('agentPc.nothingDone') : null}>
                  <DoneDay title={t('agentPc.today')} items={doneToday} onOpen={openTask} />
                  <DoneDay title={t('agentPc.yesterday')} items={doneYesterday} onOpen={openTask} />
                  <DoneDay title={t('agentPc.earlier')} items={doneEarlier} onOpen={openTask} />
                </PcSection>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <PixelButton variant="ghost" size="sm" onClick={closePc}>{t('common.close')}</PixelButton>
            </div>
          </div>
        </PixelPanel>
      </div>
    </div>
  );
}

function FlipBtn({ dir, label, onFlip }: { dir: string; label: string; onFlip: () => void }) {
  return (
    <button
      onClick={onFlip}
      title={label}
      aria-label={label}
      style={{
        border: 'none', background: 'var(--cth-cream-100)', cursor: 'pointer',
        padding: '2px 10px', fontFamily: 'var(--cth-font-ui)', fontSize: 14,
        color: 'var(--cth-ink-900)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)'
      }}
    >{dir}</button>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      minWidth: 96, padding: '6px 10px', background: 'var(--cth-paper-100)',
      boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
      display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start'
    }}>
      <span style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-ink-500)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, background: accent, boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)' }} />
        <span style={{ fontFamily: 'var(--cth-font-mono)', fontSize: 18, color: 'var(--cth-ink-900)' }}>{value}</span>
      </span>
    </div>
  );
}

const DOT: Record<HiveTask['status'], string> = {
  todo: 'var(--cth-sky)',
  doing: 'var(--cth-lemon)',
  blocked: 'var(--cth-coral)',
  done: 'var(--cth-mint)',
};

function PcSection({ title, empty, children }: { title: string; empty?: string | null; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontFamily: 'var(--cth-font-display)', fontSize: 8, color: 'var(--cth-ink-500)' }}>{title}</div>
      {empty
        ? <span style={{ fontSize: 12, color: 'var(--cth-ink-300)' }}>{empty}</span>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>}
    </div>
  );
}

function DoneDay({ title, items, onOpen }: { title: string; items: HiveTask[]; onOpen: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontFamily: 'var(--cth-font-ui)', fontSize: 11, color: 'var(--cth-ink-500)' }}>{title}</div>
      {items.map((x) => (
        <PcTaskRow key={x.id} title={x.title} status={x.status} onOpen={() => onOpen(x.id)} />
      ))}
    </div>
  );
}

function PcTaskRow({ title, status, onOpen }: { title: string; status: HiveTask['status']; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
        background: 'var(--cth-cream-200)', border: 'none', cursor: 'pointer',
        boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
        fontSize: 12, color: 'var(--cth-ink-900)', textAlign: 'left',
        fontFamily: 'var(--cth-font-ui)'
      }}
    >
      <span style={{ width: 8, height: 8, background: DOT[status], boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
    </button>
  );
}
