import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/store/store';
import { PixelPanel } from './PixelPanel';
import { PixelBadge } from './PixelBadge';
import { PixelButton } from './PixelButton';
import { parseTasks, type HiveTask } from './TasksKanban';

/**
 * The desk-PC overview: a boss-style status screen for one agent, opened by
 * clicking their avatar or desk monitor. Deliberately NOT the terminal —
 * four plain sections: doing now, on the list, done, recent terminal lines.
 * No completion dates exist in the ledger (tasks carry createdAt only, feeds
 * carry no timestamps), so nothing here claims a day it can't prove.
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
  const openTaskDetail = useStore((s) => s.openTaskDetail);
  const agent = useStore((s) => s.agents.find((a) => a.id === pcAgentId));
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePc(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePc]);

  if (!pcAgentId || !agent) return null;

  const mine = tasks.filter((x) => x.assignee === agent.id);
  const open = mine.filter((x) => x.status !== 'done');
  const doneToday = mine.filter((x) => x.status === 'done' && dayBucket(x.completedAt) === 'today');
  const doneYesterday = mine.filter((x) => x.status === 'done' && dayBucket(x.completedAt) === 'yesterday');
  const doneEarlier = mine.filter((x) => x.status === 'done' && dayBucket(x.completedAt) === 'earlier');
  const recent = feed.map(stripAnsi).filter((x) => x.trim()).slice(-8).reverse();
  const now = (agent.action || '').trim() || (agent.lastPrompt || '').trim().split(/\s+/).slice(0, 6).join(' ') || t('office.activity.idle');

  const openTask = (id: string) => { closePc(); openTaskDetail(id); };

  return (
    <div
      onClick={closePc}
      style={{
        position: 'fixed', inset: 0, zIndex: 280,
        background: 'rgba(26, 19, 32, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '94vw', maxHeight: '90vh', display: 'flex' }}>
        <PixelPanel variant="dialog" title={`${agent.name} — PC`} noPadding style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0 }}>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PixelBadge status={agent.status} />
              <span style={{ fontFamily: 'var(--cth-font-ui)', fontSize: 13, color: 'var(--cth-ink-900)' }}>{now}</span>
            </div>

            <PcSection title={t('agentPc.list')} empty={open.length === 0 ? t('agentPc.allClear') : null}>
              {open.map((x) => (
                <PcTaskRow key={x.id} title={x.title} status={x.status} onOpen={() => openTask(x.id)} />
              ))}
            </PcSection>

            <PcSection title={t('agentPc.done')} empty={mine.every((x) => x.status !== 'done') ? t('agentPc.nothingDone') : null}>
              <DoneDay title={t('agentPc.today')} items={doneToday} onOpen={openTask} />
              <DoneDay title={t('agentPc.yesterday')} items={doneYesterday} onOpen={openTask} />
              <DoneDay title={t('agentPc.earlier')} items={doneEarlier} onOpen={openTask} />
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

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <PixelButton variant="ghost" size="sm" onClick={closePc}>{t('common.close')}</PixelButton>
            </div>
          </div>
        </PixelPanel>
      </div>
    </div>
  );
}

const DOT: Record<HiveTask['status'], string> = {
  todo: 'var(--cth-sky)',
  doing: 'var(--cth-lemon)',
  blocked: 'var(--cth-coral)',
  done: 'var(--cth-mint)',
};

function PcSection({ title, empty, children }: { title: string; empty: string | null; children: React.ReactNode }) {
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
