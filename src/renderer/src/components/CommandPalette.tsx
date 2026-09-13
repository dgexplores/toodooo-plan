import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store/store';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Flip the App-level Pixi floor / list view. */
  onToggleOfficeView: () => void;
  /** Reopen the launch-time hive picker (switch workspace). */
  onSwitchHive: () => void;
}

interface Cmd {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

function godId(): string | null {
  const s = useStore.getState();
  return s.agents.find((a) => a.isGod)?.id ?? s.selectedId;
}

function goTab(tab: string) {
  const id = godId();
  if (id) useStore.getState().select(id);
  useStore.getState().requestCommandCenterTab(tab);
}

async function setFloorDelivery(paused: boolean) {
  const all = useStore.getState().agents;
  await Promise.all(all.map((a) => window.cth.controlAutoDelivery(a.id, paused).catch(() => null)));
}

/** Global command palette (Cmd/Ctrl+K). Every entry reuses an existing action —
 *  no new behavior, just one keyboard-reachable entry point for actions that
 *  were previously mouse-only across tabs, title bar and settings. */
export function CommandPalette({ open, onClose, onToggleOfficeView, onSwitchHive }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commands = useMemo<Cmd[]>(() => [
    { id: 'add-agent', label: 'Add agent', hint: 'hire', run: () => useStore.getState().setAddAgentOpen(true) },
    { id: 'go-terminal', label: 'Go to terminal', hint: 'daily', run: () => goTab('terminal') },
    { id: 'go-monitor', label: 'Go to monitor', hint: 'daily', run: () => goTab('floor') },
    { id: 'go-tasks', label: 'Go to tasks', hint: 'daily', run: () => goTab('tasks') },
    { id: 'go-ask', label: 'Go to ask me', hint: 'daily', run: () => goTab('human') },
    { id: 'go-workers', label: 'Go to workers', hint: 'daily', run: () => goTab('workers') },
    { id: 'go-spend', label: 'Go to spend', hint: 'daily · INR', run: () => goTab('spend') },
    { id: 'go-triggers', label: 'Go to triggers', hint: 'more', run: () => goTab('triggers') },
    { id: 'go-memory', label: 'Go to memory', hint: 'tabs', run: () => goTab('memory') },
    {
      id: 'search-hive', label: 'Search board, tasks, memory', hint: 'text search', run: () => {
        goTab('memory');
        useStore.getState().requestMemorySearchFocus();
      },
    },
    { id: 'go-skills', label: 'Go to skills', hint: 'more', run: () => goTab('skills') },
    { id: 'hold-delivery', label: 'Hold floor delivery', hint: 'pause all', run: () => { void setFloorDelivery(true); } },
    { id: 'resume-delivery', label: 'Resume floor delivery', hint: 'auto', run: () => { void setFloorDelivery(false); } },
    {
      id: 'open-ide', label: 'Open IDE for selected agent', hint: 'files', run: () => {
        const s = useStore.getState();
        s.setIdeOpen(true, s.selectedId);
      },
    },
    {
      id: 'toggle-focus', label: 'Toggle focus mode', hint: 'fullscreen', run: () => {
        const s = useStore.getState();
        if (s.fullscreenAgentId) { s.setFullscreen(null); return; }
        const target = s.agents.find((x) => x.id === s.selectedId && x.ptyId)
          ?? s.agents.find((x) => x.isGod && x.ptyId)
          ?? s.agents.find((x) => x.ptyId);
        if (target) s.setFullscreen(target.id);
      },
    },
    {
      id: 'open-settings', label: 'Open settings', hint: 'config', run: () => {
        window.dispatchEvent(new CustomEvent('cth:open-settings'));
      },
    },
    { id: 'toggle-view', label: 'Toggle floor / list view', hint: 'RAM', run: onToggleOfficeView },
    { id: 'switch-hive', label: 'Switch hive (workspace)', hint: 'relaunch', run: onSwitchHive },
  ], [onToggleOfficeView, onSwitchHive]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      // Focus after mount so keystrokes land in the input, not the terminal.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open ]);

  useEffect(() => { setIndex(0); }, [query]);

  if (!open) return null;

  const runAt = (i: number) => {
    const cmd = filtered[Math.max(0, Math.min(i, filtered.length - 1))];
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  return (
    <div
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        paddingTop: '12vh',
      }}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        style={{
          width: 440, maxWidth: '90vw',
          background: 'var(--cth-paper-100)',
          border: '2px solid var(--cth-ink-700)',
          boxShadow: '4px 4px 0 var(--cth-ink-700)',
          fontFamily: 'var(--cth-font-ui)',
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, filtered.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
            else if (e.key === 'Enter') runAt(index);
          }}
          placeholder="Type a command… (Esc to close)"
          aria-label="Command search"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 12px', fontSize: 14,
            background: 'transparent', color: 'var(--cth-ink-900)',
            border: 'none', borderBottom: '2px solid var(--cth-ink-700)',
            outline: 'none', fontFamily: 'var(--cth-font-ui)',
          }}
        />
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: 4 }}>
          {filtered.length === 0 && (
            <div style={{ padding: '12px', fontSize: 13, color: 'var(--cth-ink-500)' }}>
              Nothing matched.
            </div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onMouseEnter={() => setIndex(i)}
              onClick={() => runAt(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 10px',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                background: i === index ? 'var(--cth-cream-200)' : 'transparent',
                color: 'var(--cth-ink-900)',
                fontFamily: 'var(--cth-font-ui)', fontSize: 13,
              }}
            >
              <span style={{ flex: 1 }}>{cmd.label}</span>
              <span style={{ fontSize: 11, color: 'var(--cth-ink-500)' }}>{cmd.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
