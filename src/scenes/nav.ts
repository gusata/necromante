import type Phaser from 'phaser';
import { audio } from '../audio/audio';
import { COL } from '../art/palette';
import { pxText } from '../art/text';
import { DEPTH, transitionTo } from '../fx/juice';
import { fmt } from '../fx/numbers';
import { buzz } from '../platform/haptics';
import { meta } from '../platform/save';

export type NavId = 'home' | 'market' | 'arsenal' | 'tree' | 'altar' | 'hoard' | 'bestiary' | 'records' | 'options';

/** Para onde cada ícone leva: cena e, no cemitério, a aba. */
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

export const NAV_ORDER: NavId[] = ['home', 'market', 'arsenal', 'tree', 'altar', 'hoard', 'bestiary', 'records', 'options'];

export interface NavBar {
  souls: Phaser.GameObjects.BitmapText;
  /** atualiza o número de almas mostrado */
  setSouls: (v: number) => void;
}

/**
 * Barra de ícones no topo de todas as telas fora da partida (como no King Dies Rich).
 * O ícone ativo fica com moldura dourada; o nome dele aparece embaixo, junto com as almas.
 */
export function navBar(scene: Phaser.Scene, active: NavId): NavBar {
  NAV_ORDER.forEach((id, i) => {
    const x = 10 + i * 20;
    const on = id === active;
    const frame = scene.add
      .image(x, 11, on ? 'nav-on' : 'nav')
      .setDepth(DEPTH.hud)
      .setInteractive({ useHandCursor: true });
    scene.add
      .image(x, 11, `nav-${id}`)
      .setDepth(DEPTH.hud)
      .setAlpha(on ? 1 : 0.75);
    frame.on('pointerdown', () => {
      if (on) return;
      audio.play('click');
      buzz('light');
      const t = TARGETS[id];
      transitionTo(scene, t.scene, t.tab ? { tab: t.tab } : undefined);
    });
  });
  pxText(scene, 4, 25, TARGETS[active].name.toUpperCase(), COL.U).setDepth(DEPTH.hud);
  scene.add.image(150, 27, 'icon-soul').setDepth(DEPTH.hud);
  const souls = pxText(scene, 176, 25, fmt(meta.souls), COL.G).setOrigin(1, 0).setDepth(DEPTH.hud);
  return { souls, setSouls: (v) => souls.setText(fmt(v)) };
}
