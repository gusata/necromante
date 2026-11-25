import type Phaser from 'phaser';
import { COL } from '../art/palette';
import { DEPTH } from '../fx/juice';
import { meta, saveMeta } from '../platform/save';
import { TUTORIAL_STEPS } from '../sim/meta';
import type { World } from '../sim/world';

type Step = (typeof TUTORIAL_STEPS)[number];

interface Target {
  x: number;
  y: number;
}

/**
 * Tutorial sem texto, dentro da primeira run: uma mão mostra o gesto na hora em que ele é útil.
 * Arrastar o círculo logo no começo; explodir, consumir e fundir quando a situação aparece.
 * Cada dica aparece uma vez só e some sozinha se o jogador ignorar.
 */
export class Tutorial {
  private hand: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Graphics;
  private step: Step | null = null;
  private stepT = 0;
  private dragged = 0;
  private lastCircle = { x: 0, y: 0 };
  /** fator de câmera lenta enquanto uma dica de botão está na tela */
  slow = 1;

  constructor(
    scene: Phaser.Scene,
    private world: () => World,
    private buttonPos: (i: number) => Target,
  ) {
    this.hand = scene.add
      .image(0, 0, 'icon-hand')
      .setOrigin(0.3, 0)
      .setDepth(DEPTH.hud + 5)
      .setVisible(false);
    this.ring = scene.add.graphics().setDepth(DEPTH.hud + 4);
    const c = world().circle;
    this.lastCircle = { x: c.x, y: c.y };
  }

  static wanted(): boolean {
    return TUTORIAL_STEPS.some((s) => !meta.tutorial.includes(s));
  }

  private done(s: Step) {
    return meta.tutorial.includes(s);
  }

  private finish(s: Step) {
    if (!meta.tutorial.includes(s)) meta.tutorial.push(s);
    saveMeta();
    this.step = null;
    this.slow = 1;
    this.hand.setVisible(false);
    this.ring.clear();
  }

  /** O jogador apertou um botão de ação (0 explodir, 1 fundir, 2 consumir). */
  pressed(i: number) {
    const s: Step = i === 0 ? 'explode' : i === 1 ? 'fuse' : 'consume';
    if (this.step === s) this.finish(s);
  }

  update(dt: number, time: number, blocked: boolean) {
    const w = this.world();
    this.ring.clear();
    // arrastar: mede quanto o círculo andou pela mão do jogador
    const c = w.circle;
    this.dragged += Math.hypot(c.x - this.lastCircle.x, c.y - this.lastCircle.y);
    this.lastCircle = { x: c.x, y: c.y };
    if (blocked) {
      this.hand.setVisible(false);
      this.slow = 1;
      return;
    }

    if (!this.step) this.pick(w);
    if (!this.step) return;
    this.stepT += dt;
    const hand = this.hand.setVisible(true);

    if (this.step === 'drag') {
      if (this.dragged > 50) return this.finish('drag');
      // a mão arrasta o círculo até os vivos e volta
      const p = (Math.sin(this.stepT * 2.2) + 1) / 2;
      hand.setPosition(Math.round(c.x + p * -30), Math.round(c.y - p * 46 + 4)).setAlpha(this.stepT < 0.3 ? this.stepT / 0.3 : 1);
      this.ring.lineStyle(1, COL.G, 0.35 + 0.35 * (1 - p)).strokeCircle(Math.round(c.x - p * 30), Math.round(c.y - p * 46), c.r);
      return;
    }

    // dicas de botão: câmera lenta, a mão bate no botão
    const i = this.step === 'explode' ? 0 : this.step === 'fuse' ? 1 : 2;
    const still = this.step === 'explode' ? w.canExplode() : this.step === 'fuse' ? w.canFuse() : w.canConsume();
    if (!still || this.stepT > 7) {
      // a chance passou: tenta de novo numa próxima situação
      this.step = null;
      this.slow = 1;
      hand.setVisible(false);
      return;
    }
    this.slow = this.stepT < 0.4 ? 1 - this.stepT * 1.5 : 0.4;
    const b = this.buttonPos(i);
    const tap = Math.max(0, Math.sin(time * 0.012));
    // os botões são redondos: b.x, b.y é o centro
    hand.setPosition(b.x + 6, b.y + 4 - Math.round(tap * 4));
    const pulse = 0.5 + Math.sin(time * 0.015) * 0.5;
    this.ring.lineStyle(1, COL.G, 0.4 + pulse * 0.6).strokeCircle(b.x, b.y, 13 + Math.round(pulse * 2));
  }

  private pick(w: World) {
    if (w.phase !== 'spawning' && w.phase !== 'fighting') return;
    const start = (s: Step) => {
      this.step = s;
      this.stepT = 0;
    };
    if (!this.done('drag')) return start('drag');
    const livingNear = w.units.some((u) => u.alive && u.faction === 'living' && Math.hypot(u.x - w.circle.x, u.y - w.circle.y) < w.circle.r + 14);
    if (!this.done('explode') && w.deadInCircle().length >= 3 && livingNear && w.canExplode()) return start('explode');
    if (!this.done('consume') && w.necro.hp <= w.necro.maxHp * 0.7 && w.canConsume()) return start('consume');
    if (!this.done('fuse') && w.canFuse()) return start('fuse');
  }

  destroy() {
    this.hand.destroy();
    this.ring.destroy();
  }
}
