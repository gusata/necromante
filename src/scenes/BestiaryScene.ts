import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { unitKey } from '../art/generate';
import { COL } from '../art/palette';
import { pxText } from '../art/text';
import { button, DEPTH, transitionIn, transitionTo } from '../fx/juice';
import { meta } from '../platform/save';
import { BOSS_KINDS, LIVING_KINDS, UNIT_DEFS } from '../sim/defs';
import { medal, MEDALS } from '../sim/meta';
import type { UnitKind } from '../sim/types';

const MEDAL_COLOR = [0x2a2036, 0xa0603a, 0xb8c0cc, 0xf6cf6a];
const MEDAL_NAME = ['', 'bronze', 'prata', 'ouro'];

export class BestiaryScene extends Phaser.Scene {
  private detail: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Bestiary');
  }

  create() {
    this.detail = [];
    this.add.image(0, 0, 'ground1').setOrigin(0).setTint(0x8070a0);
    this.add.rectangle(0, 0, 180, 320, 0x050309, 0.75).setOrigin(0);
    pxText(this, 90, 9, 'BESTIÁRIO', COL.G).setOrigin(0.5).setScale(2);

    const kinds: UnitKind[] = [...LIVING_KINDS, ...BOSS_KINDS];
    const seen = kinds.filter((k) => (meta.kills[k] ?? 0) > 0).length;
    pxText(this, 90, 22, `${seen}/${kinds.length} conhecidos`, COL.C).setOrigin(0.5);

    kinds.forEach((k, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 24 + col * 44;
      const y = 50 + row * 42;
      const kills = meta.kills[k] ?? 0;
      const m = medal(kills);
      const tile = this.add.image(x, y, 'tile').setInteractive({ useHandCursor: true });
      const g = this.add.graphics();
      g.lineStyle(1, MEDAL_COLOR[m], 1).strokeRect(x - 19.5, y - 19.5, 39, 39);
      const boss = UNIT_DEFS[k].boss;
      const spr = this.add.image(x, y + 14, `${unitKey(k)}0`).setOrigin(0.5, 1).setScale(boss ? 1 : 2);
      if (kills === 0) spr.setTintFill(0x07050b);
      tile.on('pointerdown', () => {
        audio.play('click');
        this.showDetail(k);
      });
      // aparecem em onda
      for (const o of [tile, g, spr]) {
        o.setAlpha(0);
        this.tweens.add({ targets: o, alpha: 1, delay: 30 + i * 18, duration: 160 });
      }
    });

    button(this, 90, 308, 'VOLTAR', () => transitionTo(this, 'Menu'));
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
    const shade = this.add.rectangle(0, 0, 180, 320, 0x050309, 0.85).setOrigin(0).setDepth(DEPTH.modal).setInteractive();
    const panel = this.add.image(90, 160, 'panel').setDisplaySize(160, 150).setDepth(DEPTH.modal);
    const spr = this.add
      .image(90, 136, `${unitKey(k)}0`)
      .setOrigin(0.5, 1)
      .setScale(def.boss ? 2 : 4)
      .setDepth(DEPTH.modal + 1);
    if (!known) spr.setTintFill(0x07050b);
    const name = pxText(this, 90, 142, known ? def.name : '???', def.boss ? COL.R : COL.G).setOrigin(0.5, 0).setDepth(DEPTH.modal + 1);
    const desc = pxText(this, 90, 154, known ? wrap(def.desc, 36) : 'mate um para descobrir.', COL.c)
      .setOrigin(0.5, 0)
      .setCenterAlign()
      .setDepth(DEPTH.modal + 1);
    const next = m < MEDALS.length ? MEDALS[m as 0 | 1 | 2] : null;
    const stats = pxText(this, 90, 196, `${kills} abates${next ? `  próxima medalha: ${next}` : ''}`, COL.C).setOrigin(0.5, 0).setDepth(DEPTH.modal + 1);
    const med = pxText(this, 90, 208, m ? `medalha de ${MEDAL_NAME[m]}` : '', MEDAL_COLOR[m]).setOrigin(0.5, 0).setDepth(DEPTH.modal + 1);
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
