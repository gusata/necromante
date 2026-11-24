import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { charKey } from '../art/generate';
import { COL } from '../art/palette';
import { pxText } from '../art/text';
import { button, DEPTH, transitionIn, transitionTo } from '../fx/juice';
import { buzz } from '../platform/haptics';
import { meta } from '../platform/save';
import { SCHOOLS } from '../sim/cards';
import { CHARACTER_BY_ID, type CharacterId } from '../sim/characters';
import { ACHIEVEMENTS } from '../sim/progress';
import { wrap } from './BestiaryScene';

type Tab = 'stats' | 'history' | 'achievements';

const hex = (s: string) => parseInt(s.slice(1), 16);

const duration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min ${Math.floor(sec % 60)}s`;
};

/** Estatísticas da vida toda, histórico das últimas runs e conquistas. */
export class RecordsScene extends Phaser.Scene {
  private tab: Tab = 'stats';
  private layer: Phaser.GameObjects.GameObject[] = [];
  private tabs: { id: Tab; img: Phaser.GameObjects.Image; label: Phaser.GameObjects.BitmapText }[] = [];
  private scroll = 0;

  constructor() {
    super('Records');
  }

  create() {
    this.layer = [];
    this.tabs = [];
    this.scroll = 0;
    this.add.image(0, 0, 'ground3').setOrigin(0).setTint(0x8070a0);
    this.add.rectangle(0, 0, 180, 320, 0x050309, 0.78).setOrigin(0);
    pxText(this, 90, 9, 'REGISTROS', COL.G).setOrigin(0.5).setScale(2);

    const tabs: [Tab, string][] = [
      ['stats', 'NÚMEROS'],
      ['history', 'HISTÓRICO'],
      ['achievements', 'CONQUISTAS'],
    ];
    tabs.forEach(([id, name], i) => {
      const img = this.add
        .image(3 + i * 59, 22, 'tab')
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      const label = pxText(this, 31 + i * 59, 26, name, COL.C).setOrigin(0.5, 0);
      img.on('pointerdown', () => {
        if (this.tab === id) return;
        audio.play('click');
        buzz('light');
        this.tab = id;
        this.scroll = 0;
        this.render();
      });
      this.tabs.push({ id, img, label });
    });

    // rolar a lista de conquistas arrastando
    let lastY = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (lastY = p.y));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.tab !== 'achievements') return;
      const dy = p.y - lastY;
      lastY = p.y;
      const max = Math.max(0, ACHIEVEMENTS.length * 25 - 250);
      const next = Math.max(0, Math.min(max, this.scroll - dy));
      if (Math.abs(next - this.scroll) >= 1) {
        this.scroll = next;
        this.render();
      }
    });

    button(this, 90, 308, 'VOLTAR', () => transitionTo(this, 'Menu'));
    this.input.keyboard?.once('keydown-ESC', () => transitionTo(this, 'Menu'));
    this.render();
    transitionIn(this);
  }

  private add2<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.push(o);
    return o;
  }

  private text(x: number, y: number, s: string, c: number) {
    return this.add2(pxText(this, x, y, s, c));
  }

  private render() {
    for (const o of this.layer) o.destroy();
    this.layer = [];
    for (const t of this.tabs) {
      const on = t.id === this.tab;
      t.img.setTexture(on ? 'tab-on' : 'tab');
      t.label.setTint(on ? COL.G : COL.C);
    }
    if (this.tab === 'stats') this.renderStats();
    else if (this.tab === 'history') this.renderHistory();
    else this.renderAchievements();
  }

  private renderStats() {
    const s = meta.stats;
    const rows: [string, string][] = [
      ['runs', `${meta.runs}`],
      ['vitórias (catedral)', `${s.victories}`],
      ['onda recorde', `${meta.best.wave}`],
      ['abates', `${s.kills}`],
      ['mais abates numa run', `${s.bestKills}`],
      ['maior exército', `${s.bestArmy}`],
      ['mortos levantados', `${s.raised}`],
      ['mortos explodidos', `${s.exploded}`],
      ['rituais', `${s.rituals}`],
      ['chefes derrotados', `${s.bossKills}`],
      ['almas no total', `${meta.totalSouls}`],
      ['tempo jogado', duration(s.time)],
      ['heresia máxima', meta.heresyMax ? `${meta.heresyMax}` : '-'],
      ['conquistas', `${meta.achievements.length}/${ACHIEVEMENTS.length}`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 48 + i * 17;
      this.add2(this.add.rectangle(4, y - 3, 172, 14, i % 2 ? 0x17111f : 0x0c0a11, 0.8).setOrigin(0));
      this.text(8, y, k, COL.C);
      this.text(172, y, v, COL.G).setOrigin(1, 0);
    });
    const d = meta.daily;
    if (d.date) this.text(90, 290, `diário ${d.date}: melhor onda ${d.best} (${d.tries} tentativa${d.tries === 1 ? '' : 's'})`, COL.y).setOrigin(0.5, 0);
  }

  private renderHistory() {
    if (!meta.history.length) {
      this.text(90, 140, 'nenhuma run ainda', COL.B).setOrigin(0.5);
      return;
    }
    meta.history.slice(0, 10).forEach((h, i) => {
      const y = 44 + i * 25;
      this.add2(this.add.image(4, y, 'row').setOrigin(0).setDisplaySize(172, 24));
      const key = charKey(h.char);
      if (this.textures.exists(`${key}0`))
        this.add2(
          this.add
            .image(14, y + 22, `${key}0`)
            .setOrigin(0.5, 1)
            .setScale(0.75),
        );
      const name = CHARACTER_BY_ID[h.char as CharacterId]?.name.replace(/^(O|A) /, '').toLowerCase() ?? h.char;
      const tag = h.daily ? ' diário' : h.heresy ? ` h${h.heresy}` : '';
      this.text(26, y + 3, `onda ${h.wave} ${h.where.split(' - ')[0]}`, h.quit ? COL.C : COL.c);
      this.text(172, y + 3, `${name}${tag}`, h.daily ? COL.y : h.heresy ? COL.R : COL.C).setOrigin(1, 0);
      const school = h.school ? SCHOOLS[h.school] : null;
      this.text(26, y + 13, `${h.kills} abates  ${h.souls} almas${h.mvp ? `  mvp ${h.mvp.toLowerCase()}` : ''}`, COL.C);
      if (school) this.add2(this.add.image(166, y + 16, `school-${h.school}`).setTint(hex(school.color)));
    });
  }

  private renderAchievements() {
    const top = 40;
    ACHIEVEMENTS.forEach((a, i) => {
      const y = top + i * 25 - this.scroll;
      if (y < top - 4 || y > 252) return;
      const got = meta.achievements.includes(a.id);
      this.add2(
        this.add
          .image(4, y, got ? 'row-flash' : 'row')
          .setOrigin(0)
          .setDisplaySize(172, 24)
          .setAlpha(got ? 1 : 0.6),
      );
      this.add2(this.add.image(13, y + 12, got ? 'icon-soul' : 'icon-skull').setAlpha(got ? 1 : 0.35));
      this.text(22, y + 3, a.name.toLowerCase(), got ? COL.G : COL.C);
      this.text(22, y + 13, wrap(a.desc, 34).split('\n')[0], got ? COL.c : COL.B);
      this.text(172, y + 3, `+${a.reward}`, got ? COL.y : COL.B).setOrigin(1, 0);
    });
    this.add2(
      this.add
        .rectangle(0, 280, 180, 18, 0x050309, 1)
        .setOrigin(0)
        .setDepth(DEPTH.hud - 1),
    );
    this.text(90, 284, 'arraste para rolar', COL.B).setOrigin(0.5, 0);
  }
}
