/**
 * Tamanho da tela lógica. A largura é sempre 180; a altura acompanha o formato do celular
 * (320 num 9:16, ~390 num 9:19,5), para não sobrar faixa preta em cima e embaixo.
 *
 * O layout foi desenhado em 180x320. O que sobra de altura (GROW) é distribuído assim:
 * - fora da partida: o topo fica onde está e o que é preso na base (barra de abas, botões
 *   do rodapé) desce GROW; o meio ganha respiro;
 * - na partida: o campo continua 180x296 e a sobra aparece acima dele, como névoa de onde
 *   os vivos chegam; o HUD de cima sobe GROW.
 * As áreas seguras (notch, barra de gestos) entram na conta: nada importante fica embaixo delas.
 */

export const VIEW_W = 180;
/** altura em que o layout foi desenhado */
export const BASE_H = 320;
/** limite: celulares mais compridos que 9:20 ganham faixa (o layout não foi pensado para mais) */
const MAX_H = 400;

function param(name: string): number | null {
  if (typeof location === 'undefined') return null;
  const v = new URLSearchParams(location.search).get(name);
  return v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v);
}

/** área segura do aparelho, em pixels CSS (env(safe-area-inset-*)) */
function safeInsets(): { top: number; bottom: number } {
  if (typeof document === 'undefined' || !document.body) return { top: 0, bottom: 0 };
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(el);
  const cs = getComputedStyle(el);
  const r = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  el.remove();
  return r;
}

function measure() {
  const w = typeof window === 'undefined' ? 360 : window.innerWidth || 360;
  const h = typeof window === 'undefined' ? 640 : window.innerHeight || 640;
  // ?h=390 força a altura lógica (prints e testes em formatos diferentes)
  const forced = param('h');
  const raw = forced ?? Math.round((VIEW_W * h) / w);
  // par: com zoom 2 a tela fica em pixels inteiros dos dois lados
  const viewH = Math.max(BASE_H, Math.min(MAX_H, raw - (raw % 2)));
  const px = VIEW_W / w;
  const ins = forced === null ? safeInsets() : { top: param('st') ?? 0, bottom: param('sb') ?? 0 };
  const scale = forced === null ? px : 1;
  return { viewH, safeTop: Math.ceil(ins.top * scale), safeBottom: Math.ceil(ins.bottom * scale) };
}

const m = measure();

/** altura lógica da tela inteira */
export const VIEW_H = m.viewH;
/** faixa do notch / barra de status, em pixels lógicos */
export const SAFE_TOP = m.safeTop;
/** faixa da barra de gestos, em pixels lógicos */
export const SAFE_BOTTOM = m.safeBottom;
/** quanto a área útil passa de 320: o que é preso na base desce isso */
export const GROW = Math.max(0, VIEW_H - SAFE_TOP - SAFE_BOTTOM - BASE_H);

/** y do mundo no topo da tela, fora da partida (abaixo do notch fica o y 0) */
export const MENU_TOP = -SAFE_TOP;
/** y do mundo no topo da tela, na partida: a base (HUD de vida) continua no 320 */
export const RUN_TOP = BASE_H + SAFE_BOTTOM - VIEW_H;
/** onde o HUD de cima da partida começa (o antigo y 0) */
export const RUN_HUD_Y = RUN_TOP + SAFE_TOP;

/** rolagem da câmera de cada cena: a partida mostra a sobra acima do campo */
export const baseScrollY = (sceneKey: string) => (sceneKey === 'Run' ? RUN_TOP : MENU_TOP);
/** topo da tela no mundo, para fundos e véus de tela cheia */
export const screenTop = (sceneKey: string) => baseScrollY(sceneKey);
