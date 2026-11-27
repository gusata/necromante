import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { unitKey } from '../art/generate';
import { COL } from '../art/palette';
import { pxText } from '../art/text';
import { DEPTH, transitionIn, transitionTo } from '../fx/juice';
import { meta } from '../platform/save';
import { BOSS_KINDS, LIVING_KINDS, UNIT_DEFS } from '../sim/defs';
import { championNext, medal, MEDALS } from '../sim/meta';
import type { UnitKind } from '../sim/types';
import { navBar, TABBAR_Y } from './nav';
import { screenTop, VIEW_H } from '../fx/view';
import { GROUND_TOP } from '../art/generate';


const MEDAL_COLOR = [0x3a2a1e, 0xa0603a, 0xb8c0cc, 0xf6cf6a];
const MEDAL_NAME = ['', 'bronze', 'prata', 'ouro'];

export class BestiaryScene extends Phaser.Scene {
  private detail: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Bestiary');
  }

  create() {
    this.detail = [];
    this.add.image(0, -GROUND_TOP, 'ground1').setOrigin(0).setTint(0xb08870);
    this.add.rectangle(0, screenTop(this.scene.key), 180, VIEW_H, 0x0b0806, 0.75).setOrigin(0);
    const nav = navBar(this, 'bestiary');

    const kinds: UnitKind[] = [...LIVING_KINDS, ...BOSS_KINDS];
    const seen = kinds.filter((k) => (meta.kills[k] ?? 0) > 0).length;
    pxText(this, 90, nav.top + 1, `${seen} de ${kinds.length} descobertos`, COL.v).setOrigin(0.5, 0);

    // grade rolável entre o contador e a barra de abas
    const top = nav.top + 10;
    const bottom = TABBAR_Y - 2;
    const grid = this.add.container(0, 0);
    const maskShape = this.make.graphics({}, false).fillRect(0, top, 180, bottom - top);
    grid.setMask(maskShape.createGeometryMask());
    const rows = Math.ceil(kinds.length / 4);
    const maxScroll = Math.max(0, rows * 40 + 2 - (bottom - top));
    let scroll = 0;
    let drag: { y: number; s: number; moved: boolean } | null = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.worldY > top && p.worldY < bottom && !this.detail.length) drag = { y: p.worldY, s: scroll, moved: false };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!drag || !p.isDown) return;
      if (Math.abs(p.worldY - drag.y) > 3) drag.moved = true;
      scroll = Phaser.Math.Clamp(drag.s - (p.worldY - drag.y), 0, maxScroll);
      grid.y = -Math.round(scroll);
    });
    this.input.on('pointerup', () => this.time.delayedCall(0, () => (drag = null)));

    kinds.forEach((k, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 24 + col * 44;
      const y = top + 21 + row * 40;
      const kills = meta.kills[k] ?? 0;
      const m = medal(kills);
      const tile = this.add.image(x, y, 'stage').setInteractive({ useHandCursor: true });
      const g = this.add.graphics();
      g.lineStyle(1, MEDAL_COLOR[m], 1).strokeRect(x - 19.5, y - 19.5, 39, 39);
      const boss = UNIT_DEFS[k].boss;
      // escala inteira (grade única, docs/ARTE.md): bichos em 1x; os grandes (chefes, abominação) pela metade
      const spr = this.add.image(x, y + 14, `${unitKey(k)}0`).setOrigin(0.5, 1);
      if (boss || spr.height > 30) spr.setScale(0.5);
      if (kills === 0) spr.setTintFill(0x07050b);
      grid.add([tile, g, spr]);
      tile.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (drag?.moved || p.worldY < top || p.worldY > bottom) return;
        audio.play('click');
        this.showDetail(k);
      });
      // aparecem em onda
      for (const o of [tile, g, spr]) {
        o.setAlpha(0);
        this.tweens.add({ targets: o, alpha: 1, delay: 30 + i * 18, duration: 160 });
      }
    });

    this.input.keyboard?.once('keydown-ESC', () => transitionTo(this, 'Menu'));
    transitionIn(this);
  }

  private showDetail(k: UnitKind) {
    for (const o of this.detail) o.destroy();
    this.detail = [];
    const kills = meta.kills[k] ?? 0;
    const known = kills > 0;
    const def = UNIT_DEFS[k];
    const m = medal(kills);
    const shade = this.add.rectangle(0, screenTop(this.scene.key), 180, VIEW_H, 0x0b0806, 0.85).setOrigin(0).setDepth(DEPTH.modal).setInteractive();
    const panel = this.add.nineslice(90, 160, 'panel', undefined, 160, 150, 5, 5, 5, 5).setDepth(DEPTH.modal);
    const spr = this.add
      .image(90, 136, `${unitKey(k)}0`)
      .setOrigin(0.5, 1)
      .setScale(def.boss ? 1.5 : 3)
      .setDepth(DEPTH.modal + 1);
    if (!known) spr.setTintFill(0x07050b);
    const name = pxText(this, 90, 142, known ? def.name : '???', def.boss ? COL.R : COL.G).setOrigin(0.5, 0).setDepth(DEPTH.modal + 1);
    const desc = pxText(this, 90, 154, known ? wrap(def.desc, 36) : 'mate um para descobrir.', COL.u)
      .setOrigin(0.5, 0)
      .setCenterAlign()
      .setDepth(DEPTH.modal + 1);
    const next = m < MEDALS.length ? MEDALS[m as 0 | 1 | 2] : null;
    // chefes: em vez de medalhas, quantas mortes faltam para o campeão
    const champ = def.boss && k !== 'seraph' ? championNext(kills) : null;
    const rank = def.boss ? (meta.champions[k as keyof typeof meta.champions] ?? 0) : 0;
    const statLine = def.boss ? `${kills} abates${champ ? `  ${champ.rank === 1 ? 'campeão' : `rank ${champ.rank}`}: ${kills}/${champ.need}` : ''}` : `${kills} abates${next ? `  próxima medalha: ${next}` : ''}`;
    const stats = pxText(this, 90, 196, statLine, COL.v).setOrigin(0.5, 0).setDepth(DEPTH.modal + 1);
    const medLine = def.boss ? (rank ? `campeão rank ${rank}` : k !== 'seraph' ? 'mate mais vezes para ele servir' : '') : m ? `medalha de ${MEDAL_NAME[m]}` : '';
    const med = pxText(this, 90, 208, medLine, def.boss ? COL.y : MEDAL_COLOR[m]).setOrigin(0.5, 0).setDepth(DEPTH.modal + 1);
    this.detail.push(shade, panel, spr, name, desc, stats, med);
    for (const o of this.detail) {
      (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
      this.tweens.add({ targets: o, alpha: o === shade ? 0.85 : 1, duration: 150 });
    }
    spr.y += 6;
    this.tweens.add({ targets: spr, y: spr.y - 6, duration: 300, ease: 'Back.easeOut' });
    shade.on('pointerdown', () => {
      for (const o of this.detail) o.destroy();
      this.detail = [];
    });
  }
}

/** Quebra o texto em linhas de até `n` caracteres. */
export function wrap(text: string, n: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > n) {
      lines.push(line.trim());
      line = w;
    } else line += ' ' + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.join('\n');
}
