/** God's identity before anyone has customized it — the app's own default,
 *  not a magic string sprinkled at every spawn call site. */
export const DEFAULT_GOD_NAME = 'Deepak';

/**
 * Resolve god's display name for a (re)spawn.
 *
 * `renameAgent()` (`store.ts`) persists a rename straight into `registry.json`
 * via `hive.ts`'s `renameAgent()` — but the god-spawn effect used to rebuild
 * god's agent object from scratch with `name: DEFAULT_GOD_NAME` hardcoded in
 * three places, so a custom name reverted to "Deepak" on every app restart
 * even though the registry still had it right. Reading the persisted name
 * back here (instead of hardcoding the default) is what keeps a rename from
 * reverting. Falls back to the default only when nothing has been persisted
 * yet — a fresh hive, or a registry not yet written this run.
 *
 * Rebrand migration: a persisted exact "Michael" was the PREVIOUS default, so
 * it carries no deliberate intent — map it to the current default. Anyone
 * attached re-renames in one click and that choice wins permanently. Deliberate
 * over exact-match only: "Michael Scott" or "Not Michael" are real custom names
 * and pass through untouched.
 */
const LEGACY_DEFAULT_GOD_NAMES: readonly string[] = ['Michael'];

export function resolveGodName(persistedName: string | undefined | null): string {
  const trimmed = persistedName?.trim();
  if (!trimmed) return DEFAULT_GOD_NAME;
  if ((LEGACY_DEFAULT_GOD_NAMES as readonly string[]).includes(trimmed)) return DEFAULT_GOD_NAME;
  return trimmed;
}
