import { Haptics, ImpactStyle } from '@capacitor/haptics';

/** Vibração curta. No navegador sem suporte, não faz nada. */
export function buzz(strength: 'light' | 'medium' | 'heavy' = 'light'): void {
  const style = strength === 'heavy' ? ImpactStyle.Heavy : strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
  Haptics.impact({ style }).catch(() => {});
}
