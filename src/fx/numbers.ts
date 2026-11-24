/**
 * Números de exibição. A simulação usa números pequenos (um camponês tem 1 de vida),
 * mas na tela tudo que é vida e dano aparece multiplicado, como nos jogos do gênero:
 * números grandes dão mais sensação de impacto.
 */
export const DISPLAY_MUL = 10;

/** Formata com ponto de milhar (pt-BR): 12345 -> "12.345". */
export function fmt(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  const out = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? `-${out}` : out;
}

/** Vida e dano como aparecem na tela. */
export const showNum = (v: number) => fmt(v * DISPLAY_MUL);
