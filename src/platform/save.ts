import { Preferences } from '@capacitor/preferences';
import { freshMeta, migrate, type MetaState } from '../sim/meta';
import type { RunSnapshot } from '../sim/world';

const KEY = 'necromante.meta';
const LEGACY_KEY = 'necromante.best.v1';
const RUN_KEY = 'necromante.run';

/** Extras da cena que não são da simulação (para retomar a run). */
export interface SavedRun {
  snap: RunSnapshot;
  scene: { merchantPending: boolean; daily?: string | null };
  at: number;
}

/** Run em andamento salva (null = nenhuma). */
export let savedRun: SavedRun | null = null;

/** Estado persistente carregado no Boot. */
export let meta: MetaState = freshMeta();

export async function loadMeta(): Promise<MetaState> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) meta = migrate(JSON.parse(value));
    else {
      // save v1 ficava direto no localStorage
      const legacy = localStorage.getItem(LEGACY_KEY);
      meta = migrate(legacy ? JSON.parse(legacy) : null);
    }
  } catch {
    meta = freshMeta();
  }
  try {
    const { value } = await Preferences.get({ key: RUN_KEY });
    savedRun = value ? (JSON.parse(value) as SavedRun) : null;
    if (savedRun && savedRun.snap?.v !== 1) savedRun = null;
  } catch {
    savedRun = null;
  }
  return meta;
}

let runPending: Promise<void> | null = null;

export function saveRun(run: SavedRun): void {
  savedRun = run;
  const data = JSON.stringify(run);
  runPending = (runPending ?? Promise.resolve()).then(() => Preferences.set({ key: RUN_KEY, value: data })).catch(() => {});
}

export function clearRun(): void {
  savedRun = null;
  runPending = (runPending ?? Promise.resolve()).then(() => Preferences.remove({ key: RUN_KEY })).catch(() => {});
}

let pending: Promise<void> | null = null;

export function saveMeta(): void {
  const data = JSON.stringify(meta);
  pending = (pending ?? Promise.resolve()).then(() => Preferences.set({ key: KEY, value: data })).catch(() => {});
}

export function resetMeta(): void {
  const settings = meta.settings;
  meta = freshMeta();
  meta.settings = settings;
  saveMeta();
}
