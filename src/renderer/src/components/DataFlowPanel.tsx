import React from 'react';
import { useTranslation } from 'react-i18next';
import { BOUNDARIES, DATA_PROMISES } from '@shared/boundaries';

/**
 * R-17 data-flow page: every network surface + what the app guarantees.
 * Reads the SAME table CI pins (shared/boundaries) — docs, tests and UI
 * cannot drift apart.
 */
export function DataFlowPanel(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{t('settings.general.privacyTitle')}</div>
      <div style={{ fontSize: 12, color: 'var(--cth-ink-500)' }}>{t('settings.general.privacyBlurb')}</div>
      {BOUNDARIES.map((b) => (
        <div
          key={b.file}
          style={{
            padding: '8px 10px',
            background: 'var(--cth-paper-100)',
            boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
            fontSize: 12
          }}
        >
          <div style={{ fontWeight: 700 }}>{b.surface}</div>
          <div style={{ color: 'var(--cth-ink-700)' }}>
            {t('settings.general.privacyScope')}: {b.scope} · {t('settings.general.privacyAuth')}: {b.auth}
          </div>
          <div style={{ color: 'var(--cth-ink-500)' }}>{b.egress}</div>
        </div>
      ))}
      <div style={{ fontSize: 13, fontWeight: 700 }}>{t('settings.general.privacyPromises')}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--cth-ink-700)' }}>
        {DATA_PROMISES.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
