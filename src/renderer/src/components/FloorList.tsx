import { useTranslation } from 'react-i18next';
import { PixelBadge } from './PixelBadge';
import { SpritePortrait } from './SpritePortrait';
import { useStore } from '@/store/store';

/**
 * List-mode roster: the light alternative to the Pixi floor. Same live store
 * (agents, status, selection) with no WebGL context and no textures — click a
 * row to select that agent in the sidebar.
 */
export function FloorList({ onShowFloor }: { onShowFloor: () => void }) {
  const { t } = useTranslation();
  const agents = useStore((s) => s.agents);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const setAddAgentOpen = useStore((s) => s.setAddAgentOpen);

  return (
    <div style={{
      position: 'absolute', inset: 0, overflowY: 'auto',
      background: 'var(--cth-cream-100)', padding: 16,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      }}>
        <div style={{
          fontFamily: 'var(--cth-font-display)', fontSize: 10, lineHeight: '14px',
          color: 'var(--cth-ink-500)',
        }}>
          {t('floorList.title', { count: agents.length })}
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--cth-ink-500)' }}>
          {t('floorList.lightNote')}
        </span>
        <button
          onClick={onShowFloor}
          style={{
            padding: '4px 12px', cursor: 'pointer',
            background: 'var(--cth-cream-200)', color: 'var(--cth-ink-900)',
            border: 'none', boxShadow: 'inset 0 0 0 1px var(--cth-ink-100)',
            fontFamily: 'var(--cth-font-ui)', fontSize: 13,
          }}
        >
          {t('floorList.showFloor')}
        </button>
      </div>

      {agents.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--cth-ink-700)', lineHeight: '20px' }}>
          {t('floorList.empty')}{' '}
          <button
            onClick={() => setAddAgentOpen(true)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--cth-ink-900)', fontSize: 13, padding: 0,
              textDecoration: 'underline',
            }}
          >
            {t('floorList.addAgent')}
          </button>
        </div>
      )}

      {agents.map((a) => {
        const selected = a.id === selectedId;
        return (
          <button
            key={a.id}
            onClick={() => select(a.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', textAlign: 'left', cursor: 'pointer',
              padding: '8px 10px', marginBottom: 8, border: 'none',
              background: selected ? 'var(--cth-paper-100)' : 'var(--cth-cream-200)',
              boxShadow: selected
                ? 'inset 0 0 0 2px var(--cth-ink-900)'
                : 'inset 0 0 0 1px var(--cth-ink-100)',
              color: 'var(--cth-ink-900)',
              fontFamily: 'var(--cth-font-ui)',
            }}
          >
            <span style={{
              width: 32, height: 32, flexShrink: 0,
              background: `var(--cth-${a.accent}-light)`,
              boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <SpritePortrait character={a.character} scale={1} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontWeight: 700, fontSize: 13,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {a.name}
                </span>
                <PixelBadge status={a.status} />
                {a.isGod && (
                  <span style={{ fontSize: 11, color: 'var(--cth-ink-500)' }}>
                    {t('floorList.boss')}
                  </span>
                )}
              </span>
              <span style={{
                display: 'block', fontSize: 12, color: 'var(--cth-ink-500)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {[a.model, a.project].filter(Boolean).join(' · ')}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
