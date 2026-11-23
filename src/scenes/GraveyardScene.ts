import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { unitKey } from '../art/generate';
import { COL } from '../art/palette';
import { pxText, setPxText } from '../art/text';
import { button, DEPTH, Shaker, transitionIn, transitionTo } from '../fx/juice';
import { buzz } from '../platform/haptics';
import { meta, saveMeta } from '../platform/save';
import { BOSS_DEFS, BOSS_KINDS } from '../sim/defs';
import { BUILDINGS, buildingLevel, buy, nextCost, type Building } from '../sim/meta';
import type { BossKind } from '../sim/types';

interface Row {
  b: Building;
  bg: Phaser.GameObjects.Image;
  effect: Phaser.GameObjects.BitmapText;
  pips: Phaser.GameObjects.Graphics;
  cost: Phaser.GameObjects.BitmapText;
  btn: Phaser.GameObjects.Image;
  y: number;
}

export class GraveyardScene extends Phaser.Scene {
  private rows: Row[] = [];
  private soulsText!: Phaser.GameObjects.BitmapText;
  private shaker!: Shaker;
  private champLayer: Phaser.GameObjects.GameObject[] = [];
  private shownSouls = 0;

  constructor() {
    super('Graveyard');
  }

  create() {
    this.rows = [];
    this.shaker = new Shaker(this.cameras.main);
    this.add.image(0, 0, 'ground0').setOrigin(0).setTint(0x8070a0);
    this.add.rectangle(0, 0, 180, 320, 0x050309, 0.72).setOrigin(0);
    this.add
      .particles(0, 0, 'px', {
        x: { min: 0, max: 180 },
        y: { min: 40, max: 320 },
        lifespan: { min: 2000, max: 4000 },
        speedY: { min: -6, max: -2 },
        alpha: { start: 0.6, end: 0 },
        tint: [COL.g],
        frequency: 300,
      })
      .setDepth(DEPTH.glow);

    pxText(this, 90, 9, 'CEMITÉRIO', COL.G).setOrigin(0.5).setScale(2);
    this.add.image(64, 24, 'icon-soul');
    this.shownSouls = meta.souls;
    this.soulsText = pxText(this, 70, 22, `${meta.souls}`, COL.G);

    BUILDINGS.forEach((b, i) => this.makeRow(b, 32 + i * 28, i));
    this.buildChampions();

    button(this, 90, 308, 'VOLTAR', () => transitionTo(this, 'Menu'));
    this.input.keyboard?.once('keydown-ESC', () => transitionTo(this, 'Menu'));
    transitionIn(this);
  }

  private makeRow(b: Building, y: number, i: number) {
    const x = 4;
    const bg = this.add.image(x, y, 'row').setOrigin(0);
    const icon = this.add.image(x + 9, y + 13, b.icon);
    pxText(this, x + 19, y + 4, b.name, COL.c);
    const effect = pxText(this, x + 19, y + 14, '', COL.C);
    const pips = this.add.graphics();
    const btn = this.add.image(x + 152, y + 13, 'small-btn').setInteractive({ useHandCursor: true });
    const cost = pxText(this, x + 152, y + 11, '', COL.G).setOrigin(0.5, 0);
    const row: Row = { b, bg, effect, pips, cost, btn, y };
    btn.on('pointerdown', () => {
      btn.setTexture('small-btn-down');
      this.tryBuy(row);
    });
    btn.on('pointerup', () => btn.setTexture('small-btn'));
    btn.on('pointerout', () => btn.setTexture('small-btn'));
    this.rows.push(row);
    this.refreshRow(row);
    // entrada em cascata
    for (const o of [bg, icon, effect, pips, btn, cost]) {
      (o as unknown as { alpha: number }).alpha = 0;
      this.tweens.add({ targets: o, alpha: 1, delay: 60 + i * 40, duration: 200 });
    }
  }

  private refreshRow(row: Row) {
    const lvl = buildingLevel(meta, row.b.id);
    const max = row.b.costs.length;
    setPxText(row.effect, row.b.effect(lvl));
    row.pips.clear();
    for (let i = 0; i < max; i++) {
      row.pips.fillStyle(COL.k).fillRect(4 + 100 + i * 6, row.y + 4, 5, 5);
      row.pips.fillStyle(i < lvl ? COL.G : 0x2a2036).fillRect(4 + 101 + i * 6, row.y + 5, 3, 3);
    }
    const cost = nextCost(meta, row.b);
    setPxText(row.cost, cost === null ? 'MAX' : `${cost}`);
    const can = cost !== null && meta.souls >= cost;
    row.cost.setTint(cost === null ? COL.y : can ? COL.G : COL.B);
    row.btn.setAlpha(cost === null ? 0.5 : 1);
  }

  private tryBuy(row: Row) {
    if (!buy(meta, row.b.id)) {
      audio.play('deny');
      buzz('light');
      this.tweens.add({ targets: row.bg, x: { from: 2, to: 4 }, duration: 40, yoyo: true, repeat: 2 });
      return;
    }
    saveMeta();
    audio.play('buy');
    buzz('medium');
    this.shaker.add(0.25);
    row.bg.setTexture('row-flash');
    this.time.delayedCall(120, () => row.bg.setTexture('row'));
    const p = this.add.particles(0, 0, 'px', {
      speed: { min: 20, max: 60 },
      lifespan: 500,
      tint: [COL.G, COL.g, COL.y],
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    p.explode(24, 160, row.y + 13);
    this.time.delayedCall(700, () => p.destroy());
    for (const r of this.rows) this.refreshRow(r);
    if (row.b.id === 'hall') this.buildChampions();
  }

  /** Seleção do campeão (precisa do Salão dos Campeões). */
  private buildChampions() {
    for (const o of this.champLayer) o.destroy();
    this.champLayer = [];
    const y = 260;
    if (buildingLevel(meta, 'hall') === 0) {
      this.champLayer.push(pxText(this, 90, y + 12, 'construa o salão para levar campeões', COL.B).setOrigin(0.5));
      return;
    }
    this.champLayer.push(pxText(this, 4, y - 2, 'CAMPEÃO', COL.y));
    const opts: (BossKind | null)[] = [null, ...BOSS_KINDS];
    opts.forEach((boss, i) => {
      const x = 22 + i * 34;
      const owned = boss === null || (meta.champions[boss] ?? 0) > 0;
      const sel = meta.selectedChampion === boss;
      const frame = this.add.image(x, y + 18, 'small-btn').setDisplaySize(30, 26).setTint(sel ? 0x80ffa0 : 0xffffff);
      this.champLayer.push(frame);
      if (boss) {
        const spr = this.add.image(x, y + 30, `${unitKey('champion', boss)}0`).setOrigin(0.5, 1).setScale(0.75);
        if (!owned) spr.setTintFill(0x000000).setAlpha(0.6);
        this.champLayer.push(spr);
        if (owned) this.champLayer.push(pxText(this, x + 9, y + 6, `${meta.champions[boss]}`, COL.y));
      } else {
        this.champLayer.push(pxText(this, x, y + 15, '-', COL.C).setOrigin(0.5, 0));
      }
      frame.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (!owned) {
          audio.play('deny');
          this.flashInfo(boss ? `derrote ${BOSS_DEFS[boss].name.toLowerCase()}` : '');
          return;
        }
        meta.selectedChampion = boss;
        saveMeta();
        audio.play('click');
        buzz('light');
        this.buildChampions();
      });
    });
  }

  private flashInfo(text: string) {
    const t = pxText(this, 90, 292, text, COL.R).setOrigin(0.5).setDepth(DEPTH.hud);
    this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 300, onComplete: () => t.destroy() });
  }

  update(_t: number, delta: number) {
    this.shaker.update(delta / 1000);
    if (this.shownSouls !== meta.souls) {
      this.shownSouls += Math.sign(meta.souls - this.shownSouls) * Math.max(1, Math.round(Math.abs(meta.souls - this.shownSouls) * 0.2));
      setPxText(this.soulsText, `${this.shownSouls}`);
    }
  }
}
