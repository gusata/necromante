import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { COL } from '../art/palette';
import { pxText, setPxText } from '../art/text';
import { button, DEPTH, Shaker, transitionIn, transitionTo } from '../fx/juice';
import { fmt } from '../fx/numbers';
import { buzz } from '../platform/haptics';
import { meta, saveMeta } from '../platform/save';
import { computeMods, DOMINION_AT, MASTERY_AT, SCHOOL_ORDER, SCHOOLS, schoolCounts } from '../sim/cards';
import { UNIT_DEFS } from '../sim/defs';
import { GEM_TYPES, GEMS, gemKey, MAX_GEM_RANK, parseGem, RANK_NAME } from '../sim/gems';
import type { Mods } from '../sim/mods';
import type { DeadKind, School } from '../sim/types';
import {
  EQUIP_SLOTS,
  type EquipSlot,
  effectiveLevel,
  type Item,
  HOARD_COMPLETE,
  HOARD_ITEMS,
  ITEM_BY_ID,
  ITEMS,
  MAX_ITEM_LEVEL,
  RARITY_COLOR,
  RARITY_NAME,
  relicsOf,
  SET_BY_ID,
  SETS,
  SLOT_NAME,
  SLOT_OF,
} from '../sim/items';
import {
  buyFromMarket,
  equip,
  forgeSlot,
  type MetaState,
  metaMods,
  refreshCost,
  marketPrice,
  mergeAllGems,
  refreshMarket,
  rollMarket,
  schoolBonus,
  slotForgeCost,
  slotOfItem,
  socketGem,
  syncSockets,
  unequip,
  unsocketGem,
} from '../sim/meta';
import { REGIONS } from '../sim/regions';
import { BRANCH_BY_ID, BRANCHES, branchLevels, buyNode, lockReason, maxLevel, NODE_BY_ID, nodeCost, nodesOf, treeBuilt, treeLevel, treeTotal } from '../sim/tree';
import { wrap } from './BestiaryScene';
import { type NavId, navBar } from './nav';

type Tab = 'build' | 'market' | 'arsenal' | 'altar' | 'hoard';
const hex = (s: string) => parseInt(s.slice(1), 16);

// mapa da árvore: área visível e distâncias de cada camada a partir da necrópole
const MAP_TOP = 33;
const MAP_BOTTOM = 258;
const MAP_CX = 90;
const MAP_CY = (MAP_TOP + MAP_BOTTOM) / 2;
const TIER_R: Record<number, number> = { 1: 80, 2: 128, 3: 176, 4: 222 };
const MAP_R = 268;
const PAN_MAX = 210;
/** onde o mapa estava: volta no mesmo lugar ao comprar ou trocar de tela */
const treePan = { x: 0, y: 0 };

/** Ícone de cada nó, ligado ao efeito (os que faltam usam o ícone do ramo). */
const NODE_ICON: Record<string, string> = {
  nichos: 'b-crypt',
  covas_rasas: 'icon-skull',
  terra_fria: 'tomb',
  rito_ligeiro: 'icon-hand',
  vigilia: 'cross',
  marcha: 'school-spirit',
  catacumbas: 'b-grave',
  covas_gemeas: 'icon-fuse',
  medula: 'school-bone',
  ossos_afiados: 'item-staff_bone',
  placas: 'item-cloak_wool',
  colosso: 'nav-bestiary',
  restos: 'bones',
  mortos_elite: 'item-ring_bone',
  osso_profano: 'b-ossuary',
  leitura: 'b-library',
  circulo: 'icon-ritual',
  palavras: 'item-staff_storm',
  eco: 'school-spirit',
  liturgia: 'item-hood_seer',
  rito_duplo: 'item-staff_harvest',
  sangue_velho: 'icon-heart',
  banquete: 'icon-consume',
  coracao: 'school-blood',
  carne_volatil: 'icon-explode',
  estilhacos: 'school-flesh',
  furia: 'item-ring_blood',
  martir: 'b-altar',
  badalo: 'b-bell',
  repique: 'item-amulet_tooth',
  pacto_antigo: 'item-amulet_pact',
  mapa: 'nav-records',
  augurio: 'school-neutral',
  sino_prata: 'gem-diamond',
  contrabando: 'nav-market',
  dizimo: 'icon-soul',
  salao: 'item-amulet_reliquary',
  faro: 'item-ring_iron',
  lapidario: 'gem-ruby',
  encaixe: 'nav-altar',
  bigorna: 'nav-arsenal',
  mercado_negro: 'item-ring_abyss',
};

const nodeIcon = (scene: Phaser.Scene, id: string, fallback: string) => {
  const k = NODE_ICON[id];
  return k && scene.textures.exists(k) ? k : fallback;
};

/** Ajusta o ícone ao nó em escala inteira (pixel art não gosta de escala quebrada). */
function fitIcon(img: Phaser.GameObjects.Image, box: number) {
  const m = Math.max(img.width, img.height);
  img.setScale(m > box ? box / m : Math.max(1, Math.floor(box / m)));
}

// arsenal: boneco em cruz, mochila rolável e painel do item
const DOLL: Record<EquipSlot, [number, number]> = {
  hood: [39, 48],
  staff: [15, 72],
  cloak: [39, 72],
  amulet: [63, 72],
  ring1: [15, 96],
  ring2: [63, 96],
};
const BAG_TOP = 124;
const BAG_BOTTOM = 226;
const DETAIL_Y = 228;
const bagScroll = { y: 0 };
/** cor forte de cada cerco (estandartes do tesouro) */
const REGION_COLOR = ['#c07a40', '#4aa8a0', '#6a88d0', '#a868c8'];

/** Grupos da mochila: uma escola por grupo, depois sem escola, conjuntos e relíquias. */
const BAG_GROUPS: { name: string; color: number; school?: School; has: (i: Item) => boolean }[] = [
  { name: 'relíquias', color: hex(RARITY_COLOR.legendary), has: (i) => i.rarity === 'legendary' },
  { name: 'conjuntos', color: hex(RARITY_COLOR.set), has: (i) => i.rarity === 'set' },
  ...SCHOOL_ORDER.map((sc) => ({
    name: SCHOOLS[sc].name,
    color: hex(SCHOOLS[sc].color),
    school: sc,
    has: (i: Item) => i.rarity !== 'legendary' && i.rarity !== 'set' && Object.keys(i.school ?? {})[0] === sc,
  })),
  { name: 'sem escola', color: COL.v, has: (i) => i.rarity !== 'legendary' && i.rarity !== 'set' && !i.school },
];

/** Números que o jogador entende, com o jeito de comparar cada um. */
const STATS: { name: string; get: (m: Mods) => number; kind: 'mul' | 'add' | 'inv'; scale?: number }[] = [
  { name: 'dano dos mortos', get: (m) => m.deadDmgMul, kind: 'mul' },
  { name: 'vida dos mortos', get: (m) => m.deadHpMul / Math.max(0.05, m.deadArmor), kind: 'mul' },
  { name: 'dano dos raios', get: (m) => ((1 + m.necroDmg) * (1 + m.boltChain)) / m.castCdMul, kind: 'mul' },
  { name: 'vida do necromante', get: (m) => m.necroMaxHp, kind: 'add', scale: 10 },
  { name: 'limite do exército', get: (m) => m.armyCap, kind: 'add' },
  { name: 'dano do veneno', get: (m) => m.poisonDmgMul, kind: 'mul' },
  { name: 'dano das explosões', get: (m) => m.explodeDmgMul, kind: 'mul' },
  { name: 'raio do círculo', get: (m) => m.circleR, kind: 'add' },
  { name: 'almas', get: (m) => m.soulMul, kind: 'mul' },
  { name: 'velocidade dos mortos', get: (m) => m.deadSpeedMul, kind: 'mul' },
];

const fullMods = (state: MetaState) => computeMods(metaMods(state), [], schoolBonus(state));

/** Compara os números com e sem o item (equipar se não está, tirar se está). */
function compareEquip(id: string): { text: string; good: boolean }[] {
  const trial: MetaState = { ...meta, equipped: { ...meta.equipped } };
  const slot = slotOfItem(meta, id);
  if (slot) unequip(trial, slot);
  else equip(trial, id);
  const before = fullMods(meta);
  const after = fullMods(trial);
  const out: { text: string; good: boolean; w: number }[] = [];
  for (const st of STATS) {
    const a = st.get(before);
    const b = st.get(after);
    if (Math.abs(b - a) < 1e-6) continue;
    if (st.kind === 'mul') {
      const d = b / a - 1;
      if (Math.abs(d) < 0.005) continue;
      out.push({ text: `${d > 0 ? '+' : ''}${Math.round(d * 100)}% ${st.name}`, good: d > 0, w: Math.abs(d) });
    } else {
      const d = (b - a) * (st.scale ?? 1);
      if (Math.abs(d) < 0.5) continue;
      out.push({ text: `${d > 0 ? '+' : ''}${Math.round(d)} ${st.name}`, good: d > 0, w: Math.abs(d) / 20 });
    }
  }
  // tipos de morto que passam a levantar (ou deixam de)
  for (const k of Object.keys(after.raisePool) as DeadKind[]) {
    if (!before.raisePool[k]) out.push({ text: `passa a levantar: ${UNIT_DEFS[k].name.toLowerCase()}`, good: true, w: 9 });
  }
  for (const k of Object.keys(before.raisePool) as DeadKind[]) {
    if (!after.raisePool[k]) out.push({ text: `deixa de levantar: ${UNIT_DEFS[k].name.toLowerCase()}`, good: false, w: 9 });
  }
  // degraus de escola ganhos ou perdidos
  const cb = schoolCounts(schoolBonus(meta));
  const ca = schoolCounts(schoolBonus(trial));
  for (const sc of SCHOOL_ORDER) {
    const tier = (n: number) => (n >= DOMINION_AT ? 2 : n >= MASTERY_AT ? 1 : 0);
    const t0 = tier(cb[sc]);
    const t1 = tier(ca[sc]);
    if (t1 !== t0) {
      const name = SCHOOLS[sc].name.toLowerCase();
      out.push({ text: t1 > t0 ? `${t1 === 2 ? 'domínio' : 'maestria'} de ${name}!` : `perde ${t0 === 2 ? 'domínio' : 'maestria'} de ${name}`, good: t1 > t0, w: 10 });
    }
  }
  return out.sort((x, y) => y.w - x.w);
}

const nearest = (ps: { x: number; y: number; off: number }[], off: number) => ps.reduce((a, b) => (Math.abs(b.off - off) < Math.abs(a.off - off) ? b : a));

/** Hub de meta-progressão: construções, mercado e arsenal (equipar e forjar). */
export class GraveyardScene extends Phaser.Scene {
  private tab: Tab = 'build';
  private layer: Phaser.GameObjects.GameObject[] = [];
  private soulsText!: Phaser.GameObjects.BitmapText;
  private shownSouls = 0;
  private shaker!: Shaker;
  private selected: string | null = null;
  private map: Phaser.GameObjects.Container | null = null;
  private treeDrag: { x: number; y: number; px: number; py: number; moved: boolean } | null = null;
  private bagHeight = 0;

  constructor() {
    super('Graveyard');
  }

  init(data: { tab?: Tab }) {
    this.tab = data?.tab ?? 'build';
  }

  create() {
    this.layer = [];
    this.selected = null;
    this.shaker = new Shaker(this.cameras.main);
    if (!meta.market.length) {
      rollMarket(meta);
      saveMeta();
    }
    this.add.image(0, 0, 'ground0').setOrigin(0).setTint(0xb08870);
    this.add.rectangle(0, 0, 180, 320, 0x0b0806, 0.74).setOrigin(0);
    this.add
      .particles(0, 0, 'px', { x: { min: 0, max: 180 }, y: { min: 40, max: 320 }, lifespan: { min: 2000, max: 4000 }, speedY: { min: -6, max: -2 }, alpha: { start: 0.6, end: 0 }, tint: [COL.g], frequency: 300 })
      .setDepth(DEPTH.glow);

    // barra de ícones no topo: cada aba do cemitério é um ícone
    const navId: Record<Tab, NavId> = { build: 'tree', market: 'market', arsenal: 'arsenal', altar: 'altar', hoard: 'hoard' };
    this.shownSouls = meta.souls;
    this.soulsText = navBar(this, navId[this.tab]).souls;

    this.input.keyboard?.once('keydown-ESC', () => transitionTo(this, 'Menu'));
    this.setupTreeDrag();
    this.render(false);
    transitionIn(this);
  }

  // ================================================================ montagem

  private render(animate: boolean) {
    for (const o of this.layer) o.destroy();
    this.layer = [];
    this.map = null;
    if (this.tab === 'build') this.renderTree();
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

  // ================================================================ árvore da necrópole

  private renderTree() {
    // um mapa só, que se arrasta: a necrópole no centro e os 6 ramos saindo dela
    const map = this.add.container(MAP_CX + treePan.x, MAP_CY + treePan.y);
    this.add2(map);
    this.map = map;
    const mask = this.make.graphics({}, false).fillRect(0, MAP_TOP, 180, MAP_BOTTOM - MAP_TOP);
    map.setMask(mask.createGeometryMask());
    this.layer.push(mask);

    const g = this.add.graphics();
    map.add(g);
    // chão do mapa: disco escuro com anéis nas distâncias das camadas
    g.fillStyle(0x120d0a, 0.85).fillCircle(0, 0, MAP_R);
    g.lineStyle(1, 0x3a2c20, 0.5).strokeCircle(0, 0, MAP_R);
    for (const t of [1, 2, 3] as const) g.lineStyle(1, 0x2a2018, 0.7).strokeCircle(0, 0, (TIER_R[t] + TIER_R[t + 1]) / 2);

    const pos = new Map<string, { x: number; y: number; off: number }>();
    BRANCHES.forEach((br, bi) => {
      const a = ((-90 + bi * 60) * Math.PI) / 180;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const nodes = nodesOf(br.id);
      for (const t of [1, 2, 3, 4] as const) {
        const row = nodes.filter((nd) => nd.tier === t);
        row.forEach((nd, j) => {
          const off = (j - (row.length - 1) / 2) * 30;
          pos.set(nd.id, { x: dx * TIER_R[t] - dy * off, y: dy * TIER_R[t] + dx * off, off });
        });
      }
      const col = hex(br.color);
      // tronco do ramo (brilho fraco na cor do ramo)
      g.lineStyle(7, col, 0.08).lineBetween(dx * 26, dy * 26, dx * TIER_R[4], dy * TIER_R[4]);
      const hub = { x: dx * 46, y: dy * 46 };
      g.lineStyle(2, branchLevels(meta, br.id) > 0 ? col : 0x3a2c20, 0.8).lineBetween(dx * 24, dy * 24, hub.x, hub.y);
      // ligações: camada 1 sai do tronco; as outras, do nó mais próximo da camada de antes
      for (const nd of nodes) {
        const p = pos.get(nd.id)!;
        const parents = nd.tier === 1 ? [hub] : nd.tier === 4 ? nodes.filter((o) => o.tier === 3).map((o) => pos.get(o.id)!) : [nearest(nodes.filter((o) => o.tier === nd.tier - 1).map((o) => pos.get(o.id)!), p.off)];
        const on = treeLevel(meta, nd.id) > 0;
        for (const q of parents) g.lineStyle(2, on ? col : 0x3a2c20, on ? 0.9 : 0.7).lineBetween(q.x, q.y, p.x, p.y);
      }
      // nome do ramo depois da coroa
      const lx = dx * (TIER_R[4] + 30);
      const ly = dy * (TIER_R[4] + 30);
      map.add(this.add.image(lx, ly - 9, br.icon));
      map.add(pxText(this, lx, ly, br.name.toUpperCase(), col).setOrigin(0.5, 0));
      map.add(pxText(this, lx, ly + 8, `${branchLevels(meta, br.id)} níveis`, COL.v).setOrigin(0.5, 0));
    });

    // a necrópole no centro
    map.add(this.add.image(0, -4, 'necropolis').setScale(2));
    map.add(pxText(this, 0, 12, `${treeBuilt(meta)}/${treeTotal()}`, COL.U).setOrigin(0.5, 0));

    // nós
    const ng = this.add.graphics();
    map.add(ng);
    for (const br of BRANCHES) {
      const col = hex(br.color);
      for (const nd of nodesOf(br.id)) {
        const { x, y } = pos.get(nd.id)!;
        const lvl = treeLevel(meta, nd.id);
        const locked = lockReason(meta, nd) !== null;
        const cost = nodeCost(meta, nd);
        const maxed = cost === null;
        const crown = nd.tier === 4;
        const r = crown ? 14 : 11;
        const ring = locked ? 0x2a2018 : maxed ? 0xe0b040 : lvl > 0 ? col : 0x6a4c32;
        ng.fillStyle(0x0b0806).fillCircle(x, y, r + 1);
        ng.fillStyle(lvl > 0 ? 0x2a1f17 : 0x18120e).fillCircle(x, y, r - 1);
        ng.lineStyle(2, ring, 1).strokeCircle(x, y, r - 1);
        if (this.selected === nd.id) ng.lineStyle(1, 0xffffff, 1).strokeCircle(x, y, r + 3);
        const icon = this.add.image(x, y, crown ? 'b-hall' : nodeIcon(this, nd.id, br.icon));
        fitIcon(icon, crown ? 18 : 14);
        if (locked) icon.setTint(0x6b6452).setAlpha(0.5);
        map.add(icon);
        if (locked) map.add(this.add.image(x + r - 3, y - r + 3, 'icon-lock'));
        // pode comprar agora: pontinho verde
        else if (!maxed && meta.souls >= cost) ng.fillStyle(0x0b0806).fillCircle(x + r - 2, y - r + 2, 3).fillStyle(0x5fd08a).fillCircle(x + r - 2, y - r + 2, 2);
        // bolinhas de nível embaixo
        const mx = maxLevel(meta, nd);
        for (let k = 0; k < mx; k++) {
          const px = x - (mx - 1) * 2.5 + k * 5;
          ng.fillStyle(COL.k).fillRect(px - 2, y + r + 1, 4, 4);
          ng.fillStyle(k < lvl ? (k >= nd.max ? COL.O : col) : 0x2a2018).fillRect(px - 1, y + r + 2, 2, 2);
        }
        const hit = this.add.zone(x, y, r * 2 + 4, r * 2 + 4).setInteractive({ useHandCursor: true });
        map.add(hit);
        hit.on('pointerup', (pt: Phaser.Input.Pointer) => {
          if (this.treeDrag?.moved || pt.y < MAP_TOP || pt.y > MAP_BOTTOM) return;
          audio.play('click');
          buzz('light');
          this.selected = nd.id;
          this.render(false);
        });
      }
    }
    this.renderNodeDetail();
  }

  /** arrastar o mapa da árvore */
  private setupTreeDrag() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.tab === 'arsenal') {
        this.treeDrag = p.y >= BAG_TOP && p.y <= BAG_BOTTOM ? { x: p.x, y: p.y, px: 0, py: bagScroll.y, moved: false } : null;
        return;
      }
      this.treeDrag = this.tab === 'build' && p.y >= MAP_TOP && p.y <= MAP_BOTTOM ? { x: p.x, y: p.y, px: treePan.x, py: treePan.y, moved: false } : null;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const d = this.treeDrag;
      if (!d || !p.isDown || !this.map) return;
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) < 4) return;
      d.moved = true;
      if (this.tab === 'arsenal') {
        const min = Math.min(0, BAG_BOTTOM - BAG_TOP - this.bagHeight - 4);
        bagScroll.y = Phaser.Math.Clamp(d.py + p.y - d.y, min, 0);
        this.map.y = Math.round(BAG_TOP + bagScroll.y);
        return;
      }
      treePan.x = Phaser.Math.Clamp(d.px + p.x - d.x, -PAN_MAX, PAN_MAX);
      treePan.y = Phaser.Math.Clamp(d.py + p.y - d.y, -PAN_MAX, PAN_MAX);
      this.map.setPosition(Math.round(MAP_CX + treePan.x), Math.round(MAP_CY + treePan.y));
    });
  }

  private renderNodeDetail() {
    const y = MAP_BOTTOM + 3;
    this.add2(this.add.image(5, y, 'item-card').setOrigin(0).setDisplaySize(170, 54));
    const nd = this.selected ? NODE_BY_ID[this.selected] : null;
    if (!nd) {
      this.text(90, y + 14, 'arraste o mapa e toque num nó', COL.v).setOrigin(0.5, 0);
      this.text(90, y + 26, 'custos sobem a cada nível', COL.B).setOrigin(0.5, 0);
      return;
    }
    const lvl = treeLevel(meta, nd.id);
    const mx = maxLevel(meta, nd);
    const reason = lockReason(meta, nd);
    const cost = nodeCost(meta, nd);
    this.text(10, y + 5, nd.name.toUpperCase(), nd.tier === 4 ? COL.U : hex(BRANCH_BY_ID[nd.branch].color));
    this.text(170, y + 5, `${lvl}/${mx}`, COL.v).setOrigin(1, 0);
    this.text(10, y + 15, wrap(nd.tier === 4 ? nd.per : `por nível: ${nd.per}`, 40), COL.u);
    if (reason) {
      this.text(10, y + 38, wrap(`precisa: ${reason}`, 40).split('\n')[0], COL.R);
      return;
    }
    const can = cost !== null && meta.souls >= cost;
    const b = button(
      this,
      126,
      y + 43,
      cost === null ? 'MÁXIMO' : `${fmt(cost)}`,
      () => {
        if (buyNode(meta, nd.id)) {
          syncSockets(meta);
          this.success(126, y + 40, nd.tier === 4 ? [COL.U, 0xffffff, COL.y] : undefined);
          if (nd.tier === 4) {
            this.shaker.add(0.7);
            audio.play('synergy');
            buzz('heavy');
            this.toast(`coroa: ${nd.name.toLowerCase()}!`);
          } else this.toast(`${nd.name.toLowerCase()} nível ${treeLevel(meta, nd.id)}`);
          this.render(false);
        } else this.fail(b.img);
      },
      { tex: can ? 'btn-gold' : 'btn', down: can ? 'btn-gold-down' : 'btn-down', color: can ? COL.k : COL.v, depth: DEPTH.hud },
    );
    b.img.setDisplaySize(90, 16);
    this.layer.push(b.img, b.label);
    if (cost !== null) this.add2(this.add.image(84, y + 45, 'icon-soul').setDepth(DEPTH.hud + 2));
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
      this.text(x + 32, y + 13, wrap(it.desc(owned ? lvl + 1 : 0), 33), COL.u);
      this.text(x + 32, y + 34, owned ? `${SLOT_NAME[it.slot].toLowerCase()} - nível ${lvl} > ${lvl + 1}` : `${SLOT_NAME[it.slot].toLowerCase()} - ${RARITY_NAME[it.rarity]}`, owned ? COL.G : COL.B);
      const btn = this.add2(this.add.image(x + 152, y + 36, 'small-btn').setInteractive({ useHandCursor: true }));
      this.text(x + 152, y + 34, fmt(price), can ? COL.G : COL.B).setOrigin(0.5, 0);
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
      `RENOVAR (${fmt(refreshCost(meta))})`,
      () => {
        if (refreshMarket(meta)) {
          this.success(90, 160);
          this.render(true);
        } else this.fail(refresh.img);
      },
      { color: meta.souls >= refreshCost(meta) ? COL.u : COL.B },
    );
    this.layer.push(refresh.img, refresh.label);
    this.text(90, 278, 'o estoque muda a cada run', COL.B).setOrigin(0.5, 0);
  }

  // ================================================================ arsenal

  private renderArsenal() {
    // boneco em cruz com os 6 espaços (como no King Dies Rich)
    this.add2(this.add.image(4, 36, 'item-card').setOrigin(0).setDisplaySize(70, 74));
    for (const slot of EQUIP_SLOTS) {
      const [x, y] = DOLL[slot];
      const id = meta.equipped[slot];
      const it = id ? ITEM_BY_ID[id] : undefined;
      const frame = this.add2(this.add.image(x, y, it ? `slot-${it.rarity}` : 'slot-empty').setDisplaySize(22, 22).setInteractive({ useHandCursor: true }));
      if (it && id) {
        this.add2(this.add.image(x, y, `item-${id}`).setScale(2));
        this.schoolBadge(it, x + 8, y - 8);
      } else this.text(x, y - 3, SLOT_NAME[SLOT_OF[slot]].slice(0, 3).toUpperCase(), 0x4a3524).setOrigin(0.5, 0);
      const sl = meta.slots[slot] ?? 0;
      if (sl > 0) this.text(x - 10, y + 5, `+${sl}`, COL.O);
      if (id && id === this.selected) this.add2(this.add.graphics()).lineStyle(1, 0xffffff, 1).strokeRect(x - 12.5, y - 12.5, 25, 25);
      frame.on('pointerdown', () => {
        audio.play('click');
        this.selected = id ?? null;
        this.render(false);
      });
    }

    // escolas: quantos itens equipados de cada, com os degraus da maestria (2) e do domínio (4)
    const counts = schoolCounts(schoolBonus(meta));
    this.add2(this.add.image(76, 36, 'item-card').setOrigin(0).setDisplaySize(100, 74));
    this.text(80, 39, 'ESCOLAS', COL.U);
    SCHOOL_ORDER.forEach((sc, i) => {
      const y = 50 + i * 12;
      const n = counts[sc];
      const info = SCHOOLS[sc];
      const col = hex(info.color);
      this.add2(this.add.image(84, y + 3, `school-${sc}`).setAlpha(n > 0 ? 1 : 0.35));
      this.text(91, y, info.name.toUpperCase(), n > 0 ? col : COL.B);
      const g = this.add2(this.add.graphics());
      for (let k = 0; k < DOMINION_AT; k++) {
        const px = 134 + k * 6;
        const step = k + 1 === MASTERY_AT || k + 1 === DOMINION_AT;
        g.fillStyle(step ? 0x6a4c32 : 0x2a2018).fillRect(px - 1, y, 6, 6);
        g.fillStyle(k < n ? col : 0x0b0806).fillRect(px, y + 1, 4, 4);
      }
      if (n >= MASTERY_AT) this.text(172, y, n >= DOMINION_AT ? 'D' : 'M', n >= DOMINION_AT ? COL.O : COL.y).setOrigin(1, 0);
    });

    // mochila: agrupada por escola, arrasta para rolar
    const owned = ITEMS.filter((i) => i.id in meta.items);
    this.text(4, BAG_TOP - 9, `MOCHILA ${owned.length}/${ITEMS.length}`, COL.v);
    const bag = this.add.container(0, BAG_TOP + bagScroll.y);
    this.add2(bag);
    this.map = bag;
    const mask = this.make.graphics({}, false).fillRect(0, BAG_TOP, 180, BAG_BOTTOM - BAG_TOP);
    bag.setMask(mask.createGeometryMask());
    this.layer.push(mask);
    let y = 2;
    if (!owned.length) bag.add(pxText(this, 90, 30, wrap('mate elites e chefes, ou compre no mercado', 36), COL.B).setOrigin(0.5, 0).setCenterAlign());
    for (const grp of BAG_GROUPS) {
      const items = owned.filter(grp.has);
      if (!items.length) continue;
      if (grp.school) bag.add(this.add.image(8, y + 3, `school-${grp.school}`));
      bag.add(pxText(this, grp.school ? 15 : 4, y, grp.name.toUpperCase(), grp.color));
      y += 10;
      items.forEach((it, i) => {
        const x = 14 + (i % 7) * 25;
        const iy = y + 11 + Math.floor(i / 7) * 25;
        bag.add(this.add.image(x, iy, `slot-${it.rarity}`).setDisplaySize(22, 22));
        bag.add(this.add.image(x, iy, `item-${it.id}`).setScale(2));
        const lvl = meta.items[it.id] ?? 0;
        if (lvl) bag.add(pxText(this, x + 9, iy + 4, `${lvl}`, COL.y).setOrigin(1, 0));
        if (Object.values(meta.equipped).includes(it.id)) bag.add(this.add.rectangle(x - 8, iy - 8, 3, 3, COL.G));
        if (it.id === this.selected) bag.add(this.add.graphics().lineStyle(1, 0xffffff, 1).strokeRect(x - 12.5, iy - 12.5, 25, 25));
        const hit = this.add.zone(x, iy, 24, 24).setInteractive({ useHandCursor: true });
        bag.add(hit);
        hit.on('pointerup', (pt: Phaser.Input.Pointer) => {
          if (this.treeDrag?.moved || pt.y < BAG_TOP || pt.y > BAG_BOTTOM) return;
          audio.play('click');
          buzz('light');
          this.selected = it.id;
          this.render(false);
        });
      });
      y += Math.ceil(items.length / 7) * 25 + 4;
    }
    this.bagHeight = y;
    if (this.selected) this.renderDetail(this.selected);
    else {
      this.add2(this.add.image(5, DETAIL_Y, 'item-card').setOrigin(0).setDisplaySize(170, 90));
      this.text(90, DETAIL_Y + 22, 'toque num item para ver', COL.v).setOrigin(0.5, 0);
      this.text(90, DETAIL_Y + 34, wrap('2 itens da mesma escola: maestria. 4: domínio', 40), COL.B).setOrigin(0.5, 0).setCenterAlign();
    }
  }

  /** ícone da escola no canto do item (conjuntos mostram as duas) */
  private schoolBadge(it: Item, x: number, y: number, parent?: Phaser.GameObjects.Container) {
    Object.keys(it.school ?? {}).forEach((sc, i) => {
      const img = this.add.image(x - i * 7, y, `school-${sc}`);
      if (parent) parent.add(img);
      else this.add2(img);
    });
  }

  private renderDetail(id: string) {
    const it = ITEM_BY_ID[id];
    const lvl = meta.items[id] ?? 0;
    const slot = slotOfItem(meta, id);
    const slotLvl = slot ? (meta.slots[slot] ?? 0) : 0;
    const y = DETAIL_Y;
    this.add2(this.add.image(5, y, 'item-card').setOrigin(0).setDisplaySize(170, 90));
    this.add2(this.add.image(18, y + 14, `slot-${it.rarity}`).setDisplaySize(22, 22));
    this.add2(this.add.image(18, y + 14, `item-${id}`).setScale(2));
    this.text(32, y + 4, it.name.toUpperCase(), hex(RARITY_COLOR[it.rarity]));
    const schools = Object.keys(it.school ?? {}) as School[];
    const sub = `${SLOT_NAME[it.slot].toLowerCase()} ${RARITY_NAME[it.rarity]}${schools.length ? ` de ${schools.map((sc) => SCHOOLS[sc].name.toLowerCase()).join(' e ')}` : ''}`;
    this.text(32, y + 12, sub, COL.B);
    this.text(32, y + 20, `nível ${lvl}/${MAX_ITEM_LEVEL}${slotLvl ? ` +${slotLvl} do espaço` : ''}`, COL.B);
    this.text(10, y + 29, wrap(it.desc(effectiveLevel(lvl, slotLvl)), 42), COL.u);

    // o que muda se equipar (ou tirar): diferença real nos números, já com as escolas
    const deltas = compareEquip(id);
    const dy = y + 29 + 8 * Math.min(2, wrap(it.desc(effectiveLevel(lvl, slotLvl)), 42).split('\n').length);
    if (deltas.length) {
      deltas.slice(0, 3).forEach((d, i) => this.text(10, dy + 1 + i * 8, d.text, d.good ? COL.G : COL.R));
    } else if (it.set) {
      const set = SET_BY_ID[it.set];
      const n = EQUIP_SLOTS.filter((sl) => ITEM_BY_ID[meta.equipped[sl] ?? '']?.set === it.set).length;
      this.text(10, dy + 1, `conjunto ${set.name.toLowerCase()} ${n}/3`, hex(set.color));
    } else if (it.hoard) this.text(10, dy + 1, `tesouro: ${it.hoard.desc(lvl)}`, COL.O);

    const eq = button(
      this,
      48,
      y + 80,
      slot ? 'TIRAR' : 'EQUIPAR',
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
    const label = !slot ? 'EQUIPE P/ FORJAR' : cost === null ? 'ESPAÇO MÁXIMO' : `FORJAR ${fmt(cost)}`;
    const fg = button(
      this,
      132,
      y + 80,
      label,
      () => {
        if (slot && forgeSlot(meta, slot)) {
          this.success(132, y + 78, [COL.O, COL.y, 0xffffff]);
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
    this.text(4, 134, 'BOLSA', COL.v);
    for (let r = 1; r <= MAX_GEM_RANK; r++) this.text(74 + (r - 1) * 24, 134, RANK_NAME[r], COL.B).setOrigin(0.5, 0);
    GEM_TYPES.forEach((type, row) => {
      const y = 152 + row * 20;
      this.add2(this.add.image(12, y, `gem-${type}`));
      this.text(20, y - 3, GEMS[type].name.toLowerCase(), hex(GEMS[type].color));
      for (let r = 1; r <= MAX_GEM_RANK; r++) {
        const k = gemKey(type, r);
        const count = meta.gems[k] ?? 0;
        const x = 74 + (r - 1) * 24;
        const cell = this.add2(this.add.rectangle(x, y, 20, 16, count ? 0x2a1f17 : 0x14100c, 0.9).setInteractive({ useHandCursor: true }));
        if (count) this.text(x, y - 3, `${count}`, count >= 3 && r < MAX_GEM_RANK ? COL.y : COL.u).setOrigin(0.5, 0);
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
      { color: COL.u },
    );
    this.layer.push(merge.img, merge.label);
    this.text(90, 278, 'gemas caem de elites e chefes', COL.B).setOrigin(0.5, 0);
  }

  // ================================================================ tesouro

  private renderHoard() {
    const hoard = HOARD_ITEMS();
    const owned = hoard.filter((it) => it.id in meta.items);
    this.text(90, 36, `${owned.length} de ${hoard.length} encontrados`, COL.U).setOrigin(0.5, 0);
    const g = this.add2(this.add.graphics());

    // nicho em arco com pedestais (como o salão do tesouro do king dies rich)
    const alcove = (x: number, y: number, w: number, h: number, banner: string, items: typeof hoard) => {
      g.fillStyle(0x0b0806, 1).fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 6);
      g.fillStyle(0x2a1f17, 1).fillRoundedRect(x, y, w, h, 6);
      g.fillStyle(0x16100c, 1).fillRoundedRect(x + 3, y + 6, w - 6, h - 9, 4);
      // estandarte
      const bc = hex(banner);
      g.fillStyle(bc, 1).fillRect(x + w / 2 - 4, y - 4, 8, 9);
      g.fillStyle(0x0b0806, 1).fillTriangle(x + w / 2 - 4, y + 5, x + w / 2 + 4, y + 5, x + w / 2, y + 2);
      const step = (w - 8) / items.length;
      items.forEach((it, i) => {
        const px = x + 4 + step * (i + 0.5);
        const py = y + h - 8;
        // pedestal
        g.fillStyle(0x0b0806, 1).fillRect(px - 6, py - 1, 12, 6);
        g.fillStyle(0x4a3524, 1).fillRect(px - 5, py, 10, 4);
        g.fillStyle(bc, 0.8).fillRect(px - 5, py + 3, 10, 1);
        const have = it.id in meta.items;
        const icon = this.add2(this.add.image(px, py - 8, `item-${it.id}`).setInteractive({ useHandCursor: true }));
        if (!have) icon.setTintFill(0x3a2a1e).setAlpha(0.8);
        else {
          if (meta.items[it.id]) this.text(px + 5, py - 6, `${meta.items[it.id]}`, COL.y);
          if (it.rarity === 'legendary') this.tweens.add({ targets: icon, y: py - 10, yoyo: true, repeat: -1, duration: 900 + i * 70, ease: 'Sine.easeInOut' });
        }
        if (it.id === this.selected) {
          const hl = this.add2(this.add.graphics());
          hl.lineStyle(1, COL.U, 1).strokeRect(px - 7, py - 16, 14, 14);
        }
        icon.on('pointerdown', () => {
          audio.play('click');
          this.selected = it.id;
          this.render(false);
        });
      });
    };
    // relíquias: um nicho por cerco, cada um com as duas que só caem lá
    REGIONS.forEach((reg, i) => {
      alcove(4 + i * 44, 52, 40, 42, REGION_COLOR[i], relicsOf(i));
      this.text(24 + i * 44, 96, reg.name.split(' ').pop()!.toLowerCase().slice(0, 9), COL.v).setOrigin(0.5, 0);
    });
    SETS.forEach((set, i) =>
      alcove(
        4 + i * 58,
        112,
        54,
        38,
        set.color,
        hoard.filter((it) => it.set === set.id),
      ),
    );
    SETS.forEach((set, i) => this.text(31 + i * 58, 152, set.name.toLowerCase().split(' ')[0], hex(set.color)).setOrigin(0.5, 0));

    // bônus somados
    const lines = owned.map((it) => `- ${it.hoard!.desc(meta.items[it.id])}`);
    const done = owned.length === hoard.length;
    this.text(6, 164, lines.length ? lines.slice(0, 7).join('\n') + (lines.length > 7 ? `\n+${lines.length - 7} bônus` : '') : 'nada ainda: relíquias caem raramente dos chefes de cada cerco', lines.length ? COL.G : COL.B);
    this.text(90, 238, done ? `completo: ${HOARD_COMPLETE.desc}` : `completo dá: ${HOARD_COMPLETE.desc}`, done ? COL.y : COL.B).setOrigin(0.5, 0);
    const sel = this.selected ? ITEM_BY_ID[this.selected] : null;
    if (sel?.hoard) {
      const have = sel.id in meta.items;
      const set = sel.set ? SET_BY_ID[sel.set] : null;
      this.add2(this.add.image(5, 250, 'item-card').setOrigin(0).setDisplaySize(170, 50));
      this.text(10, 255, have ? sel.name.toLowerCase() : sel.region !== undefined ? `??? cai em ${REGIONS[sel.region].name.toLowerCase()}` : '??? (não encontrado)', hex(RARITY_COLOR[sel.rarity]));
      this.text(10, 265, `tesouro: ${sel.hoard.desc(meta.items[sel.id] ?? 0)}`, COL.u);
      if (set) {
        this.text(10, 275, wrap(`2 peças: ${set.two}`, 41).split('\n')[0], COL.v);
        this.text(10, 284, wrap(`3 peças: ${set.three}`, 41).split('\n')[0], COL.v);
      }
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
      setPxText(this.soulsText, fmt(this.shownSouls));
    }
  }
}
