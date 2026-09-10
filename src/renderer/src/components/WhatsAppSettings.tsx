import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelButton } from './PixelButton';

/**
 * WhatsApp → god's-queue settings (Cloud API, free tier). Secrets are
 * write-only: reads carry presence, typing sets, Clear clears, untouched
 * stays stored. Server starts on explicit Start, never on boot.
 */
export function WhatsAppSettings(): React.JSX.Element {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [allowlist, setAllowlist] = useState('');
  const [port, setPort] = useState('3851');
  const [verifyToken, setVerifyToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [phoneToken, setPhoneToken] = useState('');
  const [hasSecrets, setHasSecrets] = useState(false);
  const [running, setRunning] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true;
    void window.cth.getConfig().then((c) => {
      if (!alive) return;
      const w = (c as { whatsapp?: { enabled?: boolean; phoneNumberId?: string; allowlist?: string[]; port?: number } }).whatsapp;
      setEnabled(w?.enabled === true);
      setPhoneNumberId(w?.phoneNumberId ?? '');
      setAllowlist((w?.allowlist ?? []).join(', '));
      setPort(String(w?.port ?? 3851));
      setHasSecrets((c as { hasWhatsapp?: boolean }).hasWhatsapp === true);
    });
    void window.cth.whatsappStatus().then((s) => {
      if (!alive) return;
      setRunning(s.running);
      setUrl(s.url ?? '');
    }).catch(() => { /* inlet offline */ });
    return () => { alive = false; };
  }, []);

  const save = async (patch: Record<string, unknown>): Promise<boolean> => {
    try {
      await window.cth.whatsappSetConfig(patch);
      return true;
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const saveRouting = async (): Promise<void> => {
    setBusy(true);
    setNote('');
    const ok = await save({
      enabled,
      phoneNumberId: phoneNumberId.trim(),
      allowlist: allowlist.split(',').map((s) => s.trim()).filter(Boolean),
      port: Number(port) || 3851
    });
    setNote(ok ? t('settings.saved') : note);
    setBusy(false);
  };

  const saveSecrets = async (): Promise<void> => {
    setBusy(true);
    setNote('');
    const patch: Record<string, string> = {};
    if (verifyToken.trim()) patch.verifyToken = verifyToken.trim();
    if (appSecret.trim()) patch.appSecret = appSecret.trim();
    if (phoneToken.trim()) patch.phoneToken = phoneToken.trim();
    if (Object.keys(patch).length === 0) {
      setNote(t('settings.connections.whatsappNothingTyped'));
      setBusy(false);
      return;
    }
    const ok = await save(patch);
    if (ok) {
      setVerifyToken('');
      setAppSecret('');
      setPhoneToken('');
      setHasSecrets(true);
      setNote(t('settings.saved'));
    }
    setBusy(false);
  };

  const clearSecret = async (which: 'verifyToken' | 'appSecret' | 'phoneToken'): Promise<void> => {
    setBusy(true);
    setNote('');
    const ok = await save({ [which]: '' });
    if (ok) {
      setNote(t('settings.connections.cleared'));
      void window.cth.getConfig().then((c) => {
        setHasSecrets((c as { hasWhatsapp?: boolean }).hasWhatsapp === true);
      }).catch(() => { /* keep badge */ });
    }
    setBusy(false);
  };

  const start = async (): Promise<void> => {
    setBusy(true);
    setNote('');
    try {
      const res = await window.cth.whatsappStart();
      if (res.ok) {
        setRunning(true);
        const st = await window.cth.whatsappStatus().catch(() => null);
        if (st?.url) setUrl(st.url);
        setNote(st?.url ? t('settings.connections.listening') : t('settings.connections.startedNoTunnel'));
      } else {
        setNote(res.error ?? t('settings.connections.startFailed'));
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const stop = async (): Promise<void> => {
    setBusy(true);
    try {
      await window.cth.whatsappStop();
      setRunning(false);
      setUrl('');
      setNote(t('settings.connections.stopped'));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const row: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 };
  const label: React.CSSProperties = { fontSize: 12, color: 'var(--cth-ink-700)' };
  const input: React.CSSProperties = { fontFamily: 'var(--cth-font-mono)', fontSize: 12 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{t('settings.connections.whatsapp')}</div>
      <div style={{ fontSize: 12, color: 'var(--cth-ink-500)' }}>{t('settings.connections.whatsappDesc')}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: running ? 'var(--cth-mint-700, #1f7a4d)' : 'var(--cth-ink-500)' }}>
          {running ? t('settings.connections.connected') : t('settings.connections.notConnected')}
        </span>
        <PixelButton variant={enabled ? 'primary' : 'secondary'} size="sm" onClick={() => setEnabled((v) => !v)}>
          {enabled ? t('common.on') : t('common.off')}
        </PixelButton>
        <PixelButton variant="secondary" size="sm" onClick={start} disabled={busy || running}>
          {t('settings.connections.start')}
        </PixelButton>
        <PixelButton variant="secondary" size="sm" onClick={stop} disabled={busy || !running}>
          {t('settings.connections.stop')}
        </PixelButton>
        <PixelButton variant="ghost" size="sm" onClick={saveRouting} disabled={busy}>
          {t('common.save')}
        </PixelButton>
        {note && <span style={{ fontSize: 12, color: 'var(--cth-ink-500)' }}>{note}</span>}
      </div>
      {url && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ ...input, flex: 1 }} />
          <PixelButton variant="secondary" size="sm" onClick={() => { void window.cth.copyToClipboard(url); }}>
            {t('common.copy')}
          </PixelButton>
        </div>
      )}
      <div style={{ display: 'flex', gap: 16 }}>
        <label style={row}>
          <span style={label}>{t('settings.connections.whatsappPhoneId')}</span>
          <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} style={input} />
        </label>
        <label style={row}>
          <span style={label}>{t('settings.connections.whatsappPort')}</span>
          <input value={port} onChange={(e) => setPort(e.target.value)} style={input} />
        </label>
      </div>
      <label style={row}>
        <span style={label}>{t('settings.connections.whatsappAllowlist')}</span>
        <input
          value={allowlist}
          onChange={(e) => setAllowlist(e.target.value)}
          placeholder={t('settings.connections.whatsappAllowlistPh')}
          style={input}
        />
      </label>
      <div style={{ display: 'flex', gap: 16 }}>
        {([
          ['verifyToken', verifyToken, setVerifyToken, t('settings.connections.whatsappVerifyToken')],
          ['appSecret', appSecret, setAppSecret, t('settings.connections.whatsappAppSecret')],
          ['phoneToken', phoneToken, setPhoneToken, t('settings.connections.whatsappPhoneToken')]
        ] as const).map(([key, val, setVal, title]) => (
          <label key={key} style={row}>
            <span style={label}>{title}{hasSecrets ? ' ●' : ''}</span>
            <input
              type="password"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder={hasSecrets ? t('settings.connections.secretSet') : ''}
              style={input}
            />
            {hasSecrets && (
              <button
                onClick={() => { void clearSecret(key); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--cth-ink-500)', fontSize: 11, padding: 0, alignSelf: 'flex-start' }}
              >
                {t('settings.connections.clearSecret')}
              </button>
            )}
          </label>
        ))}
      </div>
      <div>
        <PixelButton variant="secondary" size="sm" onClick={saveSecrets} disabled={busy}>
          {t('settings.connections.whatsappSaveSecrets')}
        </PixelButton>
      </div>
    </div>
  );
}
