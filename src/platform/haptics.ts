import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { meta } from './save';

let last = 0;

/** Vibração curta, com limite de frequência. Respeita a opção do jogador. */
export function buzz(strength: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (!meta.settings.haptics) return;
  const now = performance.now();
  const gap = strength === 'heavy' ? 60 : 90;
  if (now - last < gap) return;
  last = now;
  const style = strength === 'heavy' ? ImpactStyle.Heavy : strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
  Haptics.impact({ style }).catch(() => {});
}

/** Padrão de batida de coração (vida baixa). */
export function heartbeat(): void {
  if (!meta.settings.haptics) return;
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  setTimeout(() => Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}), 140);
}
