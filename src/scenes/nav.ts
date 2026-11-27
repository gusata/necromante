import type Phaser from 'phaser';
import { audio } from '../audio/audio';
import { COL } from '../art/palette';
import { pxText, pxWidth } from '../art/text';
import { DEPTH, transitionTo } from '../fx/juice';
import { fmt } from '../fx/numbers';
import { buzz } from '../platform/haptics';
import { meta, saveMeta } from '../platform/save';
import { PAGES, type PageId, pageNew, pageOpen } from '../sim/unlocks';
import { wrap } from './BestiaryScene';
import { GROW, screenTop, VIEW_H } from '../fx/view';

export type NavId = 'home' | 'market' | 'arsenal' | 'tree' | 'altar' | 'hoard' | 'bestiary' | 'records' | 'options';

/** Para onde cada tela leva: cena e, no cemitério, a aba. */
const TARGETS: Record<NavId, { scene: string; tab?: string; name: string }> = {
  home: { scene: 'Menu', name: 'início' },
  market: { scene: 'Graveyard', tab: 'market', name: 'mercado' },
  arsenal: { scene: 'Graveyard', tab: 'arsenal', name: 'arsenal' },
  tree: { scene: 'Graveyard', tab: 'build', name: 'árvore' },
  altar: { scene: 'Graveyard', tab: 'altar', name: 'altar' },
  hoard: { scene: 'Graveyard', tab: 'hoard', name: 'tesouro' },
  bestiary: { scene: 'Bestiary', name: 'bestiário' },
  records: { scene: 'Records', name: 'registros' },
  options: { scene: 'Options', name: 'opções' },
};

/** As 5 abas de baixo. Uma aba pode juntar várias telas, que viram sub-abas no topo. */
const TABS: { name: string; icon: NavId; pages: NavId[] }[] = [
  { name: 'início', icon: 'home', pages: ['home'] },
  { name: 'mercado', icon: 'market', pages: ['market'] },
  { name: 'poder', icon: 'arsenal', pages: ['arsenal', 'tree', 'altar'] },
  { name: 'coleção', icon: 'hoard', pages: ['hoard', 'bestiary'] },
  { name: 'feitos', icon: 'records', pages: ['records'] },
];

/** Altura do cabeçalho; com sub-abas, o conteúdo começa em CONTENT_TOP_SUB. */
export const HEADER_H = 17;
export const CONTENT_TOP = 20;
export const CONTENT_TOP_SUB = 35;
/** Onde a barra de abas começa: o conteúdo da tela vai até aqui. Em tela comprida ela desce até o fundo. */
export const TABBAR_Y = 290 + GROW;

export interface NavBar {
  souls: Phaser.GameObjects.BitmapText;
  /** atualiza o número de almas mostrado */
  setSouls: (v: number) => void;
  /** y onde o conteúdo da tela pode começar */
  top: number;
}

/** aviso curto em cima da barra de abas */
function toast(scene: Phaser.Scene, text: string) {
  const t = pxText(scene, 90, TABBAR_Y - 12, text, COL.y)
    .setOrigin(0.5, 0)
    .setDepth(DEPTH.modal + 2);
  scene.tweens.add({ targets: t, alpha: 0, delay: 1200, duration: 300, onComplete: () => t.destroy() });
}

/** pontinho de novidade: pisca devagar */
const pulse = (scene: Phaser.Scene, o: Phaser.GameObjects.Rectangle) =>
  scene.tweens.add({ targets: o, alpha: 0.35, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

const lockedText = (id: NavId) => PAGES[id as PageId]?.need ?? '';

function go(scene: Phaser.Scene, id: NavId) {
  if (!pageOpen(meta, id)) {
    audio.play('deny');
    toast(scene, `${TARGETS[id].name}: ${lockedText(id)}`);
    return;
  }
  audio.play('click');
  buzz('light');
  const t = TARGETS[id];
  transitionTo(scene, t.scene, t.tab ? { tab: t.tab } : undefined);
}

/**
 * Navegação de todas as telas fora da partida:
 * - cabeçalho fino: nome da tela, almas e a engrenagem das opções;
 * - sub-abas logo abaixo, quando a aba junta mais de uma tela;
 * - 5 abas grandes na base, ao alcance do polegar.
 */
export function navBar(scene: Phaser.Scene, active: NavId): NavBar {
  const D = DEPTH.hud;
  const tab = TABS.find((t) => t.pages.includes(active));

  // ---- cabeçalho
  scene.add.image(0, 0, 'nav-header').setOrigin(0).setDepth(D);
  const title = active === 'options' ? 'opções' : (tab?.name ?? TARGETS[active].name);
  pxText(scene, 6, 6, title.toUpperCase(), COL.U, false, true).setDepth(D + 1);
  const souls = pxText(scene, 150, 6, fmt(meta.souls), COL.G)
    .setOrigin(1, 0)
    .setDepth(D + 1);
  const soulIcon = scene.add.image(0, 8, 'icon-soul').setDepth(D + 1);
  const placeSoul = () => (soulIcon.x = Math.round(souls.x - souls.width - 6));
  placeSoul();
  // engrenagem: abre as opções (ou volta ao início, se já estiver nelas)
  const gearOn = active === 'options';
  scene.add.image(168, 8, gearOn ? 'gear-btn-on' : 'gear-btn').setDepth(D + 1);
  scene.add
    .image(168, 8, 'nav-options')
    .setDepth(D + 2)
    .setAlpha(gearOn ? 1 : 0.8);
  scene.add
    .zone(168, 9, 24, 18)
    .setDepth(D + 3)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => go(scene, gearOn ? 'home' : 'options'));

  // ---- sub-abas
  let top = CONTENT_TOP;
  if (tab && tab.pages.length > 1) {
    top = CONTENT_TOP_SUB;
    const n = tab.pages.length;
    const w = n === 3 ? 56 : 84;
    const gap = 2;
    const x0 = Math.round((180 - (n * w + (n - 1) * gap)) / 2);
    tab.pages.forEach((id, i) => {
      const on = id === active;
      const cx = x0 + i * (w + gap) + w / 2;
      const img = scene.add
        .nineslice(cx, 26, on ? 'subtab-on' : 'subtab', undefined, w, 14, 4, 4, 4, 4)
        .setDepth(D)
        .setInteractive({ useHandCursor: !on });
      const name = TARGETS[id].name.toUpperCase();
      const open = pageOpen(meta, id);
      pxText(scene, cx, 23, name, on ? COL.U : open ? COL.v : COL.B, false, pxWidth(name, true) <= w - 8)
        .setOrigin(0.5, 0)
        .setDepth(D + 1)
        .setAlpha(open ? 1 : 0.6);
      if (!open)
        scene.add
          .image(x0 + i * (w + gap) + 7, 26, 'icon-lock')
          .setDepth(D + 1)
          .setScale(0.75)
          .setAlpha(0.8);
      if (pageNew(meta, id) && !on) pulse(scene, scene.add.rectangle(x0 + i * (w + gap) + w - 4, 21, 3, 3, 0xe0304a).setDepth(D + 2));
      if (!on) img.on('pointerdown', () => go(scene, id));
    });
  }

  // ---- abas de baixo
  scene.add.image(0, TABBAR_Y, 'nav-tabbar').setOrigin(0).setDepth(D);
  TABS.forEach((t, i) => {
    const on = t === tab;
    const cx = 18 + i * 36;
    const first = t.pages.find((p) => pageOpen(meta, p));
    // quadradinho em volta do ícone; a aba ativa ganha moldura dourada
    scene.add
      .nineslice(cx, TABBAR_Y + 12, on ? 'subtab-on' : 'subtab', undefined, 26, 18, 4, 4, 4, 4)
      .setDepth(D)
      .setAlpha(on || first ? 1 : 0.6);
    scene.add
      .image(cx, TABBAR_Y + 12, `nav-${t.icon}`)
      .setDepth(D + 1)
      .setAlpha(on ? 1 : first ? 0.55 : 0.2);
    if (!first) scene.add.image(cx, TABBAR_Y + 12, 'icon-lock').setDepth(D + 2);
    // pontinho vermelho: tem tela nova aberta nesta aba
    if (t.pages.some((p) => pageNew(meta, p) && p !== active)) pulse(scene, scene.add.rectangle(cx + 11, TABBAR_Y + 4, 4, 4, 0xe0304a).setDepth(D + 2));
    pxText(scene, cx, TABBAR_Y + 23, t.name.toUpperCase(), on ? COL.U : COL.v)
      .setOrigin(0.5, 0)
      .setDepth(D + 1)
      .setAlpha(on ? 1 : 0.8);
    scene.add
      .zone(cx, TABBAR_Y + 15, 36, 30)
      .setDepth(D + 2)
      .setInteractive({ useHandCursor: !on })
      .on('pointerdown', () => {
        // a aba ativa com sub-abas volta para a primeira tela dela
        if (on && active === (first ?? t.pages[0])) return;
        go(scene, first ?? t.pages[0]);
      });
  });

  // primeira visita a uma tela: uma frase dizendo para que ela serve
  if (pageNew(meta, active)) {
    meta.seenPages.push(active);
    saveMeta();
    const text = wrap(PAGES[active as PageId].intro, 36);
    const lines = text.split('\n').length;
    const h = 18 + lines * 8;
    const y = TABBAR_Y - h - 6;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const close = () => {
      for (const o of parts) o.destroy();
    };
    parts.push(scene.add.rectangle(0, screenTop(scene.scene.key), 180, VIEW_H, 0x0b0806, 0.55).setOrigin(0).setDepth(DEPTH.modal).setInteractive().on('pointerdown', close));
    parts.push(scene.add.nineslice(90, y + h / 2, 'panel', undefined, 168, h, 5, 5, 5, 5).setDepth(DEPTH.modal + 1));
    parts.push(
      pxText(scene, 90, y + 6, `${TARGETS[active].name.toUpperCase()} ABERTO`, COL.U)
        .setOrigin(0.5, 0)
        .setDepth(DEPTH.modal + 2),
    );
    parts.push(
      pxText(scene, 90, y + 16, text, COL.u)
        .setOrigin(0.5, 0)
        .setCenterAlign()
        .setDepth(DEPTH.modal + 2),
    );
    audio.play('synergy');
  }

  return {
    souls,
    top,
    setSouls: (v: number) => {
      souls.setText(fmt(v));
      placeSoul();
    },
  };
}
