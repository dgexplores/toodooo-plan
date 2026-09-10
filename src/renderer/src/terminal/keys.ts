/** Terminal key mappings with platform parity. Dependency-free so the mappings
 *  are unit-testable without xterm or a DOM. */

/** Key text xterm should send for Shift+Enter, or null to leave to xterm.
 *  xterm sends bare `\r` (same as Enter) by default, but Claude Code submits
 *  on Enter and expects a newline on Shift+Enter (its iTerm/VS Code keymaps do
 *  this; upstream issue #481). Without the mapping there is no way to type a
 *  multi-line prompt. Ctrl/Meta combinations are left alone for copy/paste. */
export function shiftEnterSequence(ev: { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): string | null {
  if (ev.key !== 'Enter' || !ev.shiftKey || ev.ctrlKey || ev.metaKey) return null;
  return '\n';
}
