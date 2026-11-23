/** Recorde local. Trocar por @capacitor/preferences quando entrar a meta-progressão (Fase 4). */
export interface Best {
  wave: number;
  souls: number;
}

const KEY = 'necromante.best.v1';

export function loadBest(): Best {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { wave: 0, souls: 0, ...JSON.parse(raw) };
  } catch {
    /* armazenamento indisponível */
  }
  return { wave: 0, souls: 0 };
}

export function saveBest(b: Best): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* armazenamento indisponível */
  }
}
