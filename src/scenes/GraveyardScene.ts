import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { unitKey } from '../art/generate';
import { COL } from '../art/palette';
import { pxText, setPxText } from '../art/text';
import { button, DEPTH, Shaker, transitionIn, transitionTo } from '../fx/juice';
import { buzz } from '../platform/haptics';
import { meta, saveMeta } from '../platform/save';
import { BOSS_DEFS, BOSS_KINDS } from '../sim/defs';
import { GEM_TYPES, GEMS, gemKey, MAX_GEM_RANK, parseGem, RANK_NAME } from '../sim/gems';
import {
  EQUIP_SLOTS,
  effectiveLevel,
  HOARD_COMPLETE,
  HOARD_ITEMS,
  ITEM_BY_ID,
  ITEMS,
  MAX_ITEM_LEVEL,
  MAX_SLOT_LEVEL,
  RARITY_COLOR,
  RARITY_NAME,
  SET_BY_ID,
  SLOT_NAME,
  SLOT_OF,
} from '../sim/items';
import {
  BUILDINGS,
  buildingLevel,
  buy,
  buyFromMarket,
  equip,
  forgeSlot,
  MARKET_REFRESH_COST,
  marketPrice,
  mergeAllGems,
  nextCost,
  refreshMarket,
  rollMarket,
  slotForgeCost,
  slotOfItem,
  socketGem,
  unequip,
  unsocketGem,
} from '../sim/meta';
import type { BossKind } from '../sim/types';
import { wrap } from './BestiaryScene';

type Tab = 'build' | 'market' | 'arsenal' | 'altar' | 'hoard';
const hex = (s: string) => parseInt(s.slice(1), 16);

/** Hub de meta-progressão: construções, mercado e arsenal (equipar e forjar). */
export class GraveyardScene extends Phaser.Scene {
  private tab: Tab = 'build';
  private layer: Phaser.GameObjects.GameObject[] = [];
  private tabs: { id: Tab; img: Phaser.GameObjects.Image; label: Phaser.GameObjects.BitmapText }[] = [];
  private soulsText!: Phaser.GameObjects.BitmapText;
  private shownSouls = 0;
  private shaker!: Shaker;
  private selected: string | null = null;

  constructor() {
    super('Graveyard');
  }

  init(data: { tab?: Tab }) {
    this.tab = data?.tab ?? 'build';
  }

  create() {
    this.layer = [];
    this.tabs = [];
    this.selected = null;
    this.shaker = new Shaker(this.cameras.main);
    if (!meta.market.length) {
      rollMarket(meta);
      saveMeta();
    }
    this.add.image(0, 0, 'ground0').setOrigin(0).setTint(0x8070a0);
    this.add.rectangle(0, 0, 180, 320, 0x050309, 0.74).setOrigin(0);
    this.add
      .particles(0, 0, 'px', { x: { min: 0, max: 180 }, y: { min: 40, max: 320 }, lifespan: { min: 2000, max: 4000 }, speedY: { min: -6, max: -2 }, alpha: { start: 0.6, end: 0 }, tint: [COL.g], frequency: 300 })
      .setDepth(DEPTH.glow);

    pxText(this, 90, 9, 'CEMITÉRIO', COL.G).setOrigin(0.5).setScale(2);
    this.add.image(64, 24, 'icon-soul');
    this.shownSouls = meta.souls;
    this.soulsText = pxText(this, 70, 22, `${meta.souls}`, COL.G);

    const tabs: [Tab, string][] = [
      ['build', 'OBRAS'],
      ['market', 'MERCADO'],
      ['arsenal', 'ARSENAL'],
      ['altar', 'ALTAR'],
      ['hoard', 'TESOURO'],
    ];
    tabs.forEach(([id, name], i) => {
      const img = this.add
        .image(2 + i * 35.4, 31, 'tab')
        .setOrigin(0)
        .setDisplaySize(34, 14)
        .setInteractive({ useHandCursor: true });
      const label = pxText(this, 19 + i * 35.4, 35, name, COL.C).setOrigin(0.5, 0);
      img.on('pointerdown', () => {
        if (this.tab === id) return;
        audio.play('click');
        buzz('light');
        this.tab = id;
        this.render(true);
      });
      this.tabs.push({ id, img, label });
    });

    button(this, 90, 308, 'VOLTAR', () => transitionTo(this, 'Menu'));
    this.input.keyboard?.once('keydown-ESC', () => transitionTo(this, 'Menu'));
    this.render(false);
    transitionIn(this);
  }

  // ================================================================ montagem

  private render(animate: boolean) {
    for (const o of this.layer) o.destroy();
    this.layer = [];
    for (const t of this.tabs) {
      const on = t.id === this.tab;
      t.img.setTexture(on ? 'tab-on' : 'tab');
      t.label.setTint(on ? COL.G : COL.C);
    }
    if (this.tab === 'build') this.renderBuild();
    else if (this.tab === 'market') this.renderMarket();
    else if (this.tab === 'arsenal') this.renderArsenal();
    else if (this.tab === 'altar') this.renderAltar();
    else this.renderHoard();
    if (animate) {
      for (const o of this.layer) {
        const g = o as unknown as { alpha: number; x: number };
        const x = g.x;
        g.alpha = 0;
        g.x = x + 8;
        this.tweens.add({ targets: o, alpha: 1, x, duration: 180, ease: 'Cubic.easeOut' });
      }
    }
  }

  private add2<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.push(o);
    return o;
  }

  private text(x: number, y: number, s: string, c: number) {
    return this.add2(pxText(this, x, y, s, c));
  }

  private sparkle(x: number, y: number, colors: number[] = [COL.G, COL.g, COL.y]) {
    const p = this.add.particles(0, 0, 'px', { speed: { min: 20, max: 70 }, lifespan: 500, tint: colors, alpha: { start: 1, end: 0 }, emitting: false }).setDepth(DEPTH.fx);
    p.explode(26, x, y);
    this.time.delayedCall(700, () => p.destroy());
  }

  private success(x: number, y: number, colors?: number[]) {
    saveMeta();
    audio.play('buy');
    buzz('medium');
    this.shaker.add(0.25);
    this.sparkle(x, y, colors);
  }

  private fail(target?: Phaser.GameObjects.GameObject) {
    audio.play('deny');
    buzz('light');
    if (target) this.tweens.add({ targets: target, x: '+=2', duration: 40, yoyo: true, repeat: 2 });
  }

  // ================================================================ construções

  private renderBuild() {
    BUILDINGS.forEach((b, i) => {
      const x = 4;
      const y = 48 + i * 25;
      const lvl = buildingLevel(meta, b.id);
      const cost = nextCost(meta, b);
      const bg = this.add2(this.add.image(x, y, 'row').setOrigin(0).setDisplaySize(172, 24));
      this.add2(this.add.image(x + 9, y + 12, b.icon));
      this.text(x + 19, y + 3, b.name, COL.c);
      this.text(x + 19, y + 13, b.effect(lvl), COL.C);
      const pips = this.add2(this.add.graphics());
      for (let k = 0; k < b.costs.length; k++) {
        pips.fillStyle(COL.k).fillRect(x + 104 + k * 6, y + 3, 5, 5);
        pips.fillStyle(k < lvl ? COL.G : 0x2a2036).fillRect(x + 105 + k * 6, y + 4, 3, 3);
      }
      const btn = this.add2(this.add.image(x + 152, y + 12, 'small-btn').setInteractive({ useHandCursor: true }));
      const can = cost !== null && meta.souls >= cost;
      this.text(x + 152, y + 10, cost === null ? 'MAX' : `${cost}`, cost === null ? COL.y : can ? COL.G : COL.B).setOrigin(0.5, 0);
      btn.on('pointerdown', () => {
        if (buy(meta, b.id)) {
          this.success(x + 150, y + 12);
          bg.setTexture('row-flash');
          this.time.delayedCall(120, () => this.render(false));
        } else this.fail(bg);
      });
    });
    this.renderChampions(252);
  }

  private renderChampions(y: number) {
    if (buildingLevel(meta, 'hall') === 0) {
      this.text(90, y + 12, 'construa o salão para levar campeões', COL.B).setOrigin(0.5);
      return;
    }
    this.text(4, y, 'CAMPEÃO', COL.y);
    const opts: (BossKind | null)[] = [null, ...BOSS_KINDS];
    opts.forEach((boss, i) => {
      const x = 17 + i * 29;
      const owned = boss === null || (meta.champions[boss] ?? 0) > 0;
      const sel = meta.selectedChampion === boss;
      const frame = this.add2(this.add.image(x, y + 23, sel ? 'slot-rare' : 'slot-empty').setDisplaySize(27, 28));
      if (boss) {
        const spr = this.add2(this.add.image(x, y + 36, `${unitKey('champion', boss)}0`).setOrigin(0.5, 1).setScale(0.8));
        if (!owned) spr.setTintFill(0x000000).setAlpha(0.6);
        if (owned) this.text(x + 7, y + 10, `${meta.champions[boss]}`, COL.y);
      } else this.text(x, y + 20, '-', COL.C).setOrigin(0.5, 0);
      frame.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (!owned) {
          this.fail(frame);
          if (boss) this.toast(`derrote ${BOSS_DEFS[boss].name.toLowerCase()}`);
          return;
        }
        meta.selectedChampion = boss;
        saveMeta();
        audio.play('click');
        buzz('light');
        this.render(false);
      });
    });
  }

  // ================================================================ mercado

  private renderMarket() {
    this.text(90, 48, 'MERCADO DO COVEIRO', COL.y).setOrigin(0.5, 0);
    if (!meta.market.length) this.text(90, 120, 'estoque vazio. renove ou jogue uma run.', COL.B).setOrigin(0.5);
    meta.market.forEach((id, i) => {
      const it = ITEM_BY_ID[id];
      if (!it) return;
      const x = 5;
      const y = 60 + i * 48;
      const owned = id in meta.items;
      const lvl = meta.items[id] ?? 0;
      const price = marketPrice(meta, id);
      const can = meta.souls >= price;
      const bg = this.add2(this.add.image(x, y, 'item-card').setOrigin(0));
      this.add2(this.add.image(x + 16, y + 22, `slot-${it.rarity}`));
      this.add2(this.add.image(x + 16, y + 22, `item-${id}`).setScale(2));
      this.text(x + 32, y + 4, it.name.toUpperCase(), hex(RARITY_COLOR[it.rarity]));
      this.text(x + 32, y + 13, wrap(it.desc(owned ? lvl + 1 : 0), 33), COL.c);
      this.text(x + 32, y + 34, owned ? `${SLOT_NAME[it.slot].toLowerCase()} - nível ${lvl} > ${lvl + 1}` : `${SLOT_NAME[it.slot].toLowerCase()} - ${RARITY_NAME[it.rarity]}`, owned ? COL.G : COL.B);
      const btn = this.add2(this.add.image(x + 152, y + 36, 'small-btn').setInteractive({ useHandCursor: true }));
      this.text(x + 152, y + 34, `${price}`, can ? COL.G : COL.B).setOrigin(0.5, 0);
      btn.on('pointerdown', () => {
        if (buyFromMarket(meta, id)) {
          this.success(x + 16, y + 22, [hex(RARITY_COLOR[it.rarity]), 0xffffff]);
          if (it.rarity === 'legendary') this.shaker.add(0.5);
          this.toast(owned ? `${it.name.toLowerCase()} subiu para nível ${meta.items[id]}` : `${it.name.toLowerCase()} foi para o arsenal`);
          this.time.delayedCall(150, () => this.render(false));
        } else this.fail(bg);
      });
    });
    const refresh = button(
      this,
      90,
      262,
      `RENOVAR (${MARKET_REFRESH_COST})`,
      () => {
        if (refreshMarket(meta)) {
          this.success(90, 160);
          this.render(true);
        } else this.fail(refresh.img);
      },
      { color: meta.souls >= MARKET_REFRESH_COST ? COL.c : COL.B },
    );
    this.layer.push(refresh.img, refresh.label);
    this.text(90, 278, 'o estoque muda a cada run', COL.B).setOrigin(0.5, 0);
  }

  // ================================================================ arsenal

  private renderArsenal() {
    // espaços equipados
    EQUIP_SLOTS.forEach((slot, i) => {
      const x = 17 + i * 29;
      const y = 60;
      const id = meta.equipped[slot];
      const it = id ? ITEM_BY_ID[id] : undefined;
      const frame = this.add2(this.add.image(x, y, it ? `slot-${it.rarity}` : 'slot-empty').setInteractive({ useHandCursor: true }));
      if (it && id) {
        this.add2(this.add.image(x, y, `item-${id}`).setScale(2));
        if (meta.items[id]) this.text(x + 6, y + 5, `${meta.items[id]}`, COL.y);
      } else this.text(x, y - 3, SLOT_NAME[SLOT_OF[slot]].slice(0, 3).toUpperCase(), 0x3a3048).setOrigin(0.5, 0);
      // forja do espaço: fica no espaço, vale para qualquer item ali
      const sl = meta.slots[slot] ?? 0;
      if (sl > 0) this.text(x - 11, y - 12, `+${sl}`, COL.O);
      if (id && id === this.selected) this.highlight(x, y);
      frame.on('pointerdown', () => {
        audio.play('click');
        this.selected = id ?? null;
        this.render(false);
      });
    });
    this.text(90, 76, 'EQUIPADOS  (+N = forja do espaço)', COL.B).setOrigin(0.5, 0);

    // inventário
    const owned = ITEMS.filter((i) => i.id in meta.items);
    this.text(4, 88, `INVENTÁRIO ${owned.length}/${ITEMS.length}`, COL.C);
    if (!owned.length) this.text(90, 130, 'mate elites e chefes, ou compre no mercado', COL.B).setOrigin(0.5);
    owned.forEach((it, i) => {
      const x = 17 + (i % 6) * 29;
      const y = 112 + Math.floor(i / 6) * 28;
      const frame = this.add2(this.add.image(x, y, `slot-${it.rarity}`).setInteractive({ useHandCursor: true }));
      this.add2(this.add.image(x, y, `item-${it.id}`).setScale(2));
      if (meta.items[it.id]) this.text(x + 6, y + 5, `${meta.items[it.id]}`, COL.y);
      if (Object.values(meta.equipped).includes(it.id)) this.add2(this.add.rectangle(x - 9, y - 9, 3, 3, COL.G));
      if (it.id === this.selected) this.highlight(x, y);
      frame.on('pointerdown', () => {
        audio.play('click');
        buzz('light');
        this.selected = it.id;
        this.render(false);
      });
    });
    if (this.selected) this.renderDetail(this.selected);
  }

  private highlight(x: number, y: number) {
    const g = this.add2(this.add.graphics());
    g.lineStyle(1, COL.G, 1).strokeRect(x - 13.5, y - 13.5, 27, 27);
    this.tweens.add({ targets: g, alpha: 0.3, yoyo: true, repeat: -1, duration: 400 });
  }

  private renderDetail(id: string) {
    const it = ITEM_BY_ID[id];
    const lvl = meta.items[id] ?? 0;
    const slot = slotOfItem(meta, id);
    const slotLvl = slot ? (meta.slots[slot] ?? 0) : 0;
    const y = 216;
    this.add2(this.add.image(5, y, 'item-card').setOrigin(0).setDisplaySize(170, 70));
    this.text(10, y + 4, it.name.toUpperCase(), hex(RARITY_COLOR[it.rarity]));
    this.text(10, y + 13, `${SLOT_NAME[it.slot].toLowerCase()} ${RARITY_NAME[it.rarity]} - nível ${lvl}/${MAX_ITEM_LEVEL}${slotLvl ? ` +${slotLvl} do espaço` : ''}`, COL.B);
    this.text(10, y + 23, wrap(it.desc(effectiveLevel(lvl, slotLvl)), 40), COL.c);
    if (it.set) {
      const set = SET_BY_ID[it.set];
      const n = EQUIP_SLOTS.filter((s) => ITEM_BY_ID[meta.equipped[s] ?? '']?.set === it.set).length;
      this.text(10, y + 41, `conjunto ${set.name.toLowerCase()} ${n}/3`, hex(set.color));
    } else if (it.hoard) this.text(10, y + 41, `tesouro: ${it.hoard.desc(lvl)}`, COL.O);
    const eqLabel = slot ? 'TIRAR' : 'EQUIPAR';
    const eq = button(
      this,
      48,
      y + 58,
      eqLabel,
      () => {
        if (slot) unequip(meta, slot);
        else equip(meta, id);
        saveMeta();
        audio.play('fuse');
        buzz('medium');
        this.shaker.add(0.15);
        this.render(false);
      },
      { tex: 'btn', down: 'btn-down', color: COL.G },
    );
    // a forja melhora o espaço onde o item está, não o item
    const cost = slot ? slotForgeCost(meta, slot) : null;
    const label = !slot ? 'EQUIPE P/ FORJAR' : cost === null || slotLvl >= MAX_SLOT_LEVEL ? 'ESPAÇO MÁXIMO' : `FORJAR ${cost}`;
    const fg = button(
      this,
      132,
      y + 58,
      label,
      () => {
        if (slot && forgeSlot(meta, slot)) {
          this.success(132, y + 56, [COL.O, COL.y, 0xffffff]);
          audio.play('slam');
          this.shaker.add(0.35);
          this.toast(`espaço ${SLOT_NAME[SLOT_OF[slot]].toLowerCase()} agora é +${meta.slots[slot]}`);
          this.render(false);
        } else this.fail(fg.img);
      },
      { tex: 'btn', down: 'btn-down', color: cost !== null && slot && meta.souls >= cost ? COL.O : COL.B },
    );
    this.layer.push(eq.img, eq.label, fg.img, fg.label);
  }

  // ================================================================ altar (gemas)

  private renderAltar() {
    this.text(90, 48, 'ALTAR DAS GEMAS', COL.y).setOrigin(0.5, 0);
    const n = meta.sockets.length;
    meta.sockets.forEach((key, i) => {
      const x = 90 + (i - (n - 1) / 2) * 32;
      const y = 74;
      const g = key ? parseGem(key) : null;
      const frame = this.add2(this.add.image(x, y, g ? 'slot-rare' : 'slot-empty').setInteractive({ useHandCursor: true }));
      if (g) {
        this.add2(this.add.image(x, y - 1, `gem-${g.type}`).setScale(2));
        this.text(x + 7, y + 5, RANK_NAME[g.rank], COL.w);
      }
      frame.on('pointerdown', () => {
        if (unsocketGem(meta, i)) {
          this.success(x, y, [hex(GEMS[g!.type].color)]);
          this.render(false);
        } else this.fail(frame);
      });
    });
    const active = meta.sockets.map((k) => (k ? parseGem(k) : null)).filter((g) => g !== null);
    this.text(90, 92, active.length ? active.map((g) => GEMS[g.type].desc(g.rank)).join('\n') : 'toque numa gema da bolsa para encaixar', active.length ? COL.G : COL.B)
      .setOrigin(0.5, 0)
      .setCenterAlign();

    // bolsa: uma linha por tipo, colunas por nível
    this.text(4, 134, 'BOLSA', COL.C);
    for (let r = 1; r <= MAX_GEM_RANK; r++) this.text(74 + (r - 1) * 24, 134, RANK_NAME[r], COL.B).setOrigin(0.5, 0);
    GEM_TYPES.forEach((type, row) => {
      const y = 152 + row * 20;
      this.add2(this.add.image(12, y, `gem-${type}`));
      this.text(20, y - 3, GEMS[type].name.toLowerCase(), hex(GEMS[type].color));
      for (let r = 1; r <= MAX_GEM_RANK; r++) {
        const k = gemKey(type, r);
        const count = meta.gems[k] ?? 0;
        const x = 74 + (r - 1) * 24;
        const cell = this.add2(this.add.rectangle(x, y, 20, 16, count ? 0x1f1830 : 0x0c0a11, 0.9).setInteractive({ useHandCursor: true }));
        if (count) this.text(x, y - 3, `${count}`, count >= 3 && r < MAX_GEM_RANK ? COL.y : COL.c).setOrigin(0.5, 0);
        cell.on('pointerdown', () => {
          if (!count) return this.fail(cell);
          if (!meta.sockets.includes(null)) {
            this.toast('altar cheio: toque numa gema do altar para tirar');
            return this.fail(cell);
          }
          socketGem(meta, k);
          this.success(x, y, [hex(GEMS[type].color), 0xffffff]);
          this.render(false);
        });
      }
    });
    const merge = button(
      this,
      90,
      262,
      'FUNDIR 3 EM 1',
      () => {
        const n2 = mergeAllGems(meta);
        if (n2 > 0) {
          this.success(90, 200, [0xa060d0, COL.y, 0xffffff]);
          audio.play('fuse');
          this.toast(`${n2} fusão${n2 > 1 ? 'ões' : ''}`);
          this.render(false);
        } else {
          this.toast('precisa de 3 gemas iguais');
          this.fail(merge.img);
        }
      },
      { color: COL.c },
    );
    this.layer.push(merge.img, merge.label);
    this.text(90, 278, 'gemas caem de elites e chefes', COL.B).setOrigin(0.5, 0);
  }

  // ================================================================ tesouro

  private renderHoard() {
    const hoard = HOARD_ITEMS();
    const owned = hoard.filter((it) => it.id in meta.items);
    this.text(90, 48, `TESOURO ${owned.length}/${hoard.length}`, COL.O).setOrigin(0.5, 0);
    this.text(90, 58, 'bônus valem mesmo guardados', COL.B).setOrigin(0.5, 0);
    hoard.forEach((it, i) => {
      const x = 22 + (i % 6) * 27;
      const y = 82 + Math.floor(i / 6) * 28;
      const have = it.id in meta.items;
      const frame = this.add2(this.add.image(x, y, have ? `slot-${it.rarity}` : 'slot-empty').setInteractive({ useHandCursor: true }));
      const icon = this.add2(this.add.image(x, y, `item-${it.id}`).setScale(2));
      if (!have) icon.setTintFill(0x07050b).setAlpha(0.7);
      else if (meta.items[it.id]) this.text(x + 6, y + 5, `${meta.items[it.id]}`, COL.y);
      if (it.id === this.selected) this.highlight(x, y);
      frame.on('pointerdown', () => {
        audio.play('click');
        this.selected = it.id;
        this.render(false);
      });
    });
    // bônus somados
    const lines = owned.map((it) => `- ${it.hoard!.desc(meta.items[it.id])}`);
    const done = owned.length === hoard.length;
    this.text(6, 170, lines.length ? lines.slice(0, 7).join('\n') + (lines.length > 7 ? `\n+${lines.length - 7} bônus` : '') : 'nenhuma relíquia ainda', lines.length ? COL.G : COL.B);
    this.text(90, 244, done ? `completo: ${HOARD_COMPLETE.desc}` : `completo dá: ${HOARD_COMPLETE.desc}`, done ? COL.y : COL.B).setOrigin(0.5, 0);
    const sel = this.selected ? ITEM_BY_ID[this.selected] : null;
    if (sel?.hoard) {
      const have = sel.id in meta.items;
      const set = sel.set ? SET_BY_ID[sel.set] : null;
      this.add2(this.add.rectangle(4, 254, 172, 40, 0x0e0b14, 0.95).setOrigin(0));
      this.text(8, 257, have ? sel.name.toLowerCase() : '??? (não encontrado)', hex(RARITY_COLOR[sel.rarity]));
      this.text(8, 266, set ? `${set.name.toLowerCase()} 2: ${set.two}` : `tesouro: ${sel.hoard.desc(meta.items[sel.id] ?? 0)}`, COL.c);
      if (set) this.text(8, 275, wrap(`3: ${set.three}`, 42), COL.c);
    }
  }

  private toast(text: string) {
    const t = pxText(this, 90, 294, text, COL.y).setOrigin(0.5).setDepth(DEPTH.hud);
    this.tweens.add({ targets: t, alpha: 0, y: 290, delay: 1200, duration: 300, onComplete: () => t.destroy() });
  }

  update(_t: number, delta: number) {
    this.shaker.update(delta / 1000);
    if (this.shownSouls !== meta.souls) {
      this.shownSouls += Math.sign(meta.souls - this.shownSouls) * Math.max(1, Math.round(Math.abs(meta.souls - this.shownSouls) * 0.2));
      setPxText(this.soulsText, `${this.shownSouls}`);
    }
  }
}
