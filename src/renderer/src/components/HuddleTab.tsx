import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/store/store';
import { buildHuddles, buildThread, type Huddle, type HuddleMsg, type ThreadLine, type ThreadMsg } from '@shared/huddleFeed';

/**
 * The huddle tab: who talks to whom, hot first. Pair cards show the two
 * agents, the exchange count and the latest subject; expanding a card lists
 * recent subjects. Subjects only — message bodies stay in the inbox files.
 * Reads the existing hive:log bridge on the Activity-tab cadence. No new IPC.
 */
export function HuddleTab() {
  const { t } = useTranslation();
  const agents = useStore((s) => s.agents);
  const [log, setLog] = useState<HuddleMsg[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, ThreadLine[] | null>>({});

  const refresh = useCallback(async () => {
    try { setLog((await window.cth.hiveLog(200)) as HuddleMsg[]); } catch { /* keep last good */ }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const nameOf = (id: string): string =>
    agents.find((a) => a.id === id)?.name ?? id;
  const huddles: Huddle[] = buildHuddles(log, agents.map((a) => a.id));

  // Publish the hottest recent pairs for the floor huddle director (they walk
  // together while both idle). Same 5s cadence, JSON-compared — no-op polls
  // don't touch the store.
  const setHotPairs = useStore((s) => s.setHotPairs);
  const lastHot = useRef('');
  useEffect(() => {
    const hot = huddles
      .filter((h) => Date.now() - h.lastTs < 120_000)
      .slice(0, 2)
      .map((h) => ({ a: h.a, b: h.b, subject: h.lastSubject }));
    const key = JSON.stringify(hot);
    if (key === lastHot.current) return;
    lastHot.current = key;
    setHotPairs(hot);
  });

  // Thread bodies stay in the inbox files: on expand, pull both agents'
  // read-layer messages (secret-scrubbed main-side) and merge the pair
  // thread. Cached per pair for the session.
  const toggle = (h: Huddle) => {
    const key = `${h.a} ${h.b}`;
    if (openKey === key) { setOpenKey(null); return; }
    setOpenKey(key);
    if (threads[key] !== undefined) return;
    setThreads((prev) => ({ ...prev, [key]: null }));
    void Promise.all([
      window.cth.hiveMessages({ agentId: h.a, limit: 40 }).catch(() => []),
      window.cth.hiveMessages({ agentId: h.b, limit: 40 }).catch(() => [])
    ]).then(([aMsgs, bMsgs]) => {
      setThreads((prev) => ({
        ...prev,
        [key]: buildThread(aMsgs as ThreadMsg[], bMsgs as ThreadMsg[], h.a, h.b)
      }));
    });
  };

  if (huddles.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: 'var(--cth-ink-500)' }}>
        {t('huddle.empty')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, overflowY: 'auto' }}>
      {huddles.map((h) => {
        const key = `${h.a} ${h.b}`;
        const open = openKey === key;
        return (
          <div key={key} style={{
            background: 'var(--cth-paper-100)',
            boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
            padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6
          }}>
            <button
              onClick={() => toggle(h)}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                fontFamily: 'var(--cth-font-ui)', fontSize: 13, color: 'var(--cth-ink-900)'
              }}
            >
              <span style={{ width: 8, height: 8, background: 'var(--cth-brand)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)', flexShrink: 0 }} />
              <span style={{ fontWeight: 700 }}>{nameOf(h.a)} ↔ {nameOf(h.b)}</span>
              <span style={{
                marginLeft: 'auto', fontFamily: 'var(--cth-font-mono)', fontSize: 11,
                color: 'var(--cth-ink-700)', flexShrink: 0
              }}>
                {t('huddle.msgs', { count: h.total })}
              </span>
            </button>
            <span style={{
              fontSize: 12, color: 'var(--cth-ink-500)', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {h.lastSubject ?? t('huddle.noSubject')}
            </span>
            {open && (
              <ThreadView
                lines={threads[key]}
                nameOf={nameOf}
                loadingLabel={t('huddle.loading')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ThreadView({ lines, nameOf, loadingLabel }: {
  lines: ThreadLine[] | null | undefined;
  nameOf: (id: string) => string;
  loadingLabel: string;
}) {
  if (!lines) {
    return <span style={{ fontSize: 12, color: 'var(--cth-ink-300)' }}>{loadingLabel}</span>;
  }
  if (lines.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12, alignItems: 'baseline' }}>
          <span style={{ color: 'var(--cth-ink-300)', flexShrink: 0, fontFamily: 'var(--cth-font-mono)', fontSize: 11 }}>
            {nameOf(l.from)} → {nameOf(l.to)}
          </span>
          <span style={{
            flexShrink: 0, fontSize: 10, padding: '0 4px',
            background: 'var(--cth-cream-200)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-100)',
            color: 'var(--cth-ink-700)'
          }}>
            {l.act}
          </span>
          <span style={{ color: 'var(--cth-ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {l.subject}
          </span>
          {l.ts > 0 && (
            <span style={{ marginLeft: 'auto', flexShrink: 0, fontFamily: 'var(--cth-font-mono)', fontSize: 10, color: 'var(--cth-ink-300)' }}>
              {new Date(l.ts).toLocaleString()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
