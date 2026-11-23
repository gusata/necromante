import { Preferences } from '@capacitor/preferences';
import { freshMeta, migrate, type MetaState } from '../sim/meta';

const KEY = 'necromante.meta';
const LEGACY_KEY = 'necromante.best.v1';

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
  return meta;
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
