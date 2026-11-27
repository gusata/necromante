/**
 * Painel com moldura (docs/ARTE.md, "Interface"): é a base de todos os botões, painéis, linhas, cartões e abas.
 * - borda externa escura, cantos com o pixel cortado;
 * - moldura de 1 px em relevo: luz em cima e à esquerda, sombra embaixo e à direita;
 * - filete escuro por dentro da moldura (moldura dupla, como a tampa de um baú);
 * - miolo com um pontilhado de luz descendo do alto;
 * - cantoneiras de metal em L nos quatro cantos e rebites nos painéis maiores.
 */
export function panelTex(scene: Phaser.Scene, key: string, w: number, h: number, fill: string, frame: string, border: string = UI.dark) {
  const { tex, ctx } = canvas(scene, key, w, h);
  const rect = (x: number, y: number, rw: number, rh: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, rw, rh);
  };
  rect(0, 0, w, h, border);
  // moldura em relevo
  rect(1, 1, w - 2, h - 2, frame);
  rect(1, 1, w - 2, 1, mix(frame, '#ffffff', 0.22));
  rect(1, 1, 1, h - 2, mix(frame, '#ffffff', 0.12));
  rect(1, h - 2, w - 2, 1, mix(frame, '#000000', 0.3));
  rect(w - 2, 1, 1, h - 2, mix(frame, '#000000', 0.22));
  // filete escuro e miolo
  const big = w >= 16 && h >= 12;
  const inset = big ? 3 : 2;
  if (big) rect(2, 2, w - 4, h - 4, mix(fill, '#000000', 0.55));
  rect(inset, inset, w - inset * 2, h - inset * 2, fill);
  // luz do alto, pontilhada (2 linhas)
  for (let y = inset; y < inset + 2 && y < h - inset; y++)
    for (let x = inset; x < w - inset; x++) if (y === inset || (x + y) % 2 === 0) px(ctx, x, y, mix(fill, '#ffffff', y === inset ? 0.1 : 0.05));
  rect(inset, h - inset - 1, w - inset * 2, 1, mix(fill, '#000000', 0.3));
  // cantos cortados
  for (const [x, y] of [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ])
    ctx.clearRect(x, y, 1, 1);
  for (const [x, y] of [
    [1, 1],
    [w - 2, 1],
    [1, h - 2],
    [w - 2, h - 2],
  ])
    rect(x, y, 1, 1, border);
  // cantoneiras de metal em L sobre a moldura
  if (big) {
    const hi = mix(frame, '#ffffff', 0.45);
    for (const [cx, cy, dx, dy] of [
      [2, 1, 1, 0],
      [1, 2, 0, 1],
      [w - 3, 1, -1, 0],
      [w - 2, 2, 0, 1],
      [2, h - 2, 1, 0],
      [1, h - 3, 0, -1],
      [w - 3, h - 2, -1, 0],
      [w - 2, h - 3, 0, -1],
    ]) {
      px(ctx, cx, cy, hi);
      px(ctx, cx + dx, cy + dy, hi);
    }
  }
  // rebites nos painéis maiores
  if (w >= 24 && h >= 18) {
    for (const [x, y] of [
      [4, 4],
      [w - 5, 4],
      [4, h - 5],
      [w - 5, h - 5],
    ]) {
      px(ctx, x, y, mix(frame, '#ffffff', 0.3));
      px(ctx, x + 1, y + 1, mix(fill, '#000000', 0.5));
    }
  }
  tex.refresh();
}
