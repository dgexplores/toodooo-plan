import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/store/store';
import { buildHuddles, type Huddle, type HuddleMsg } from '@shared/huddleFeed';

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
              onClick={() => setOpenKey(open ? null : key)}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
                {h.recent.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--cth-ink-300)', flexShrink: 0 }}>{nameOf(r.from)}</span>
                    <span style={{ color: 'var(--cth-ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.subject}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
