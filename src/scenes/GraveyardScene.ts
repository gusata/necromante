import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { COL } from '../art/palette';
import { cap, pxCount, pxText } from '../art/text';
import { button, DEPTH, Shaker, transitionIn, transitionTo } from '../fx/juice';
import { fmt } from '../fx/numbers';
import { buzz } from '../platform/haptics';
import { meta, saveMeta } from '../platform/save';
import { APOTHEOSIS_AT, BASE_AT, computeMods, DOMINION_AT, MASTERY_AT, SCHOOL_ORDER, SCHOOLS, schoolCounts, schoolTier, TIER_NAME } from '../sim/cards';
import { UNIT_DEFS } from '../sim/defs';
import { GEM_RANK_TITLE, GEM_TYPES, GEMS, gemKey, MAX_GEM_RANK, parseGem } from '../sim/gems';
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
  type Slot,
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
import { type NavBar, type NavId, navBar } from './nav';
import { GROW, screenTop, VIEW_H } from '../fx/view';
import { GROUND_TOP } from '../art/generate';


type Tab = 'build' | 'market' | 'arsenal' | 'altar' | 'hoard';
const hex = (s: string) => parseInt(s.slice(1), 16);

// mapa da árvore: área visível e distâncias de cada camada a partir da necrópole
const MAP_TOP = 33;
const MAP_BOTTOM = 232 + GROW;
const MAP_CX = 90;
const MAP_CY = (MAP_TOP + MAP_BOTTOM) / 2;
const TIER_R: Record<number, number> = { 1: 80, 2: 128, 3: 176, 4: 222 };
const MAP_R = 268;
const PAN_MAX = 210;
/** onde o mapa estava: volta no mesmo lugar ao comprar ou trocar de tela */
const treePan = { x: 0, y: 0 };

/**
 * Ícone de cada nó: o desenhado à mão (`node-<id>`, folha "nos" do manifesto) quando existe;
 * senão um ícone emprestado ligado ao efeito; senão o ícone do ramo.
 */
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
  if (scene.textures.exists(`node-${id}`)) return `node-${id}`;
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
  hood: [42, 51],
  staff: [18, 75],
  cloak: [42, 75],
  amulet: [66, 75],
  ring1: [18, 99],
  ring2: [66, 99],
};
const BAG_TOP = 130;
const BAG_BOTTOM = 288 + GROW;
const bagScroll = { y: 0 };
/** espaço do boneco tocado: a mochila mostra só itens que cabem nele (e equipar vai para ele) */
const bagFilter: { slot: EquipSlot | null } = { slot: null };
/** nome do filtro no título da mochila */
const SLOT_PLURAL: Record<Slot, string> = { staff: 'cajados', hood: 'capuzes', cloak: 'mantos', amulet: 'amuletos', ring: 'anéis' };

/** Espaço onde o item vai entrar: o do filtro, se couber; senão um vazio; senão o primeiro. */
function targetSlot(id: string): EquipSlot {
  const slot = ITEM_BY_ID[id].slot;
  if (bagFilter.slot && SLOT_OF[bagFilter.slot] === slot) return bagFilter.slot;
  const slots = EQUIP_SLOTS.filter((s) => SLOT_OF[s] === slot);
  return slots.find((s) => !meta.equipped[s]) ?? slots[0];
}
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
interface Delta {
  text: string;
  good: boolean;
  /** 'stat' tem valor e nome separados (caixas do popup); 'gain'/'loss' são escolas e tipos de morto */
  kind: 'stat' | 'change';
  value?: string;
  name?: string;
}

function compareEquip(id: string): Delta[] {
  const trial: MetaState = { ...meta, equipped: { ...meta.equipped } };
  const slot = slotOfItem(meta, id);
  if (slot) unequip(trial, slot);
  else equip(trial, id, targetSlot(id));
  const before = fullMods(meta);
  const after = fullMods(trial);
  const out: (Delta & { w: number })[] = [];
  for (const st of STATS) {
    const a = st.get(before);
    const b = st.get(after);
    if (Math.abs(b - a) < 1e-6) continue;
    if (st.kind === 'mul') {
      const d = b / a - 1;
      if (Math.abs(d) < 0.005) continue;
      const value = `${d > 0 ? '+' : ''}${Math.round(d * 100)}%`;
      out.push({ text: `${value} ${st.name}`, value, name: st.name, kind: 'stat', good: d > 0, w: Math.abs(d) });
    } else {
      const d = (b - a) * (st.scale ?? 1);
      if (Math.abs(d) < 0.5) continue;
      const value = `${d > 0 ? '+' : ''}${Math.round(d)}`;
      out.push({ text: `${value} ${st.name}`, value, name: st.name, kind: 'stat', good: d > 0, w: Math.abs(d) / 20 });
    }
  }
  // tipos de morto que passam a levantar (ou deixam de)
  for (const k of Object.keys(after.raisePool) as DeadKind[]) {
    if (!before.raisePool[k]) out.push({ text: `levanta ${UNIT_DEFS[k].name.toLowerCase()}`, kind: 'change', good: true, w: 9 });
  }
  for (const k of Object.keys(before.raisePool) as DeadKind[]) {
    if (!after.raisePool[k]) out.push({ text: `levantar ${UNIT_DEFS[k].name.toLowerCase()}`, kind: 'change', good: false, w: 9 });
  }
  // degraus de escola ganhos ou perdidos
  const cb = schoolCounts(schoolBonus(meta));
  const ca = schoolCounts(schoolBonus(trial));
  for (const sc of SCHOOL_ORDER) {
    const t0 = schoolTier(cb[sc]);
    const t1 = schoolTier(ca[sc]);
    if (t1 !== t0) {
      const name = SCHOOLS[sc].name.toLowerCase();
      out.push({ text: `${name} ${TIER_NAME[Math.max(t1, t0)]}`, kind: 'change', good: t1 > t0, w: 10 });
    } else if ((cb[sc] >= BASE_AT) !== (ca[sc] >= BASE_AT)) {
      out.push({ text: `${SCHOOLS[sc].name.toLowerCase()} básico`, kind: 'change', good: ca[sc] > cb[sc], w: 6 });
    }
  }
  return out.sort((x, y) => y.w - x.w);
}

const nearest = (ps: { x: number; y: number; off: number }[], off: number) => ps.reduce((a, b) => (Math.abs(b.off - off) < Math.abs(a.off - off) ? b : a));

/** Hub de meta-progressão: construções, mercado e arsenal (equipar e forjar). */
export class GraveyardScene extends Phaser.Scene {
  private tab: Tab = 'build';
  /** gema escolhida no catálogo do altar (o segundo toque encaixa) */
  private selectedGem: string | null = null;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private nav!: NavBar;
  private shownSouls = 0;
  private shaker!: Shaker;
  private selected: string | null = null;
  private map: Phaser.GameObjects.Container | null = null;
  private treeDrag: { x: number; y: number; px: number; py: number; moved: boolean } | null = null;
  private bagHeight = 0;
  /** item que acabou de voltar para a mochila (pisca uma vez) */
  private flashId: string | null = null;
  /** escola tocada no painel ESCOLAS: abre o popup com os 4 degraus */
  private schoolSel: School | null = null;

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
    this.add.image(0, -GROUND_TOP, 'ground0').setOrigin(0).setTint(0xb08870);
    this.add.rectangle(0, screenTop(this.scene.key), 180, VIEW_H, 0x0b0806, 0.74).setOrigin(0);
    this.add
      .particles(0, 0, 'px', { x: { min: 0, max: 180 }, y: { min: 40, max: VIEW_H }, lifespan: { min: 2000, max: 4000 }, speedY: { min: -6, max: -2 }, alpha: { start: 0.6, end: 0 }, tint: [COL.g], frequency: 300 })
      .setDepth(DEPTH.glow);

    // barra de ícones no topo: cada aba do cemitério é um ícone
    const navId: Record<Tab, NavId> = { build: 'tree', market: 'market', arsenal: 'arsenal', altar: 'altar', hoard: 'hoard' };
    this.shownSouls = meta.souls;
    this.nav = navBar(this, navId[this.tab]);

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

  private text(x: number, y: number, s: string, c: number, wide = false) {
    return this.add2(pxText(this, x, y, s, c, false, wide));
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
        const icon = this.add.image(x, y, nodeIcon(this, nd.id, crown ? 'b-hall' : br.icon));
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
          if (this.treeDrag?.moved || pt.worldY < MAP_TOP || pt.worldY > MAP_BOTTOM) return;
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
        this.treeDrag = p.worldY >= BAG_TOP && p.worldY <= BAG_BOTTOM ? { x: p.worldX, y: p.worldY, px: 0, py: bagScroll.y, moved: false } : null;
        return;
      }
      this.treeDrag = this.tab === 'build' && p.worldY >= MAP_TOP && p.worldY <= MAP_BOTTOM ? { x: p.worldX, y: p.worldY, px: treePan.x, py: treePan.y, moved: false } : null;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const d = this.treeDrag;
      if (!d || !p.isDown || !this.map) return;
      if (!d.moved && Math.hypot(p.worldX - d.x, p.worldY - d.y) < 4) return;
      d.moved = true;
      if (this.tab === 'arsenal') {
        const min = Math.min(0, BAG_BOTTOM - BAG_TOP - this.bagHeight - 4);
        bagScroll.y = Phaser.Math.Clamp(d.py + p.worldY - d.y, min, 0);
        this.map.y = Math.round(BAG_TOP + bagScroll.y);
        return;
      }
      treePan.x = Phaser.Math.Clamp(d.px + p.worldX - d.x, -PAN_MAX, PAN_MAX);
      treePan.y = Phaser.Math.Clamp(d.py + p.worldY - d.y, -PAN_MAX, PAN_MAX);
      this.map.setPosition(Math.round(MAP_CX + treePan.x), Math.round(MAP_CY + treePan.y));
    });
  }

  private renderNodeDetail() {
    const y = MAP_BOTTOM + 3;
    this.add2(this.add.nineslice(5, y, 'item-card', undefined, 170, 54, 5, 5, 5, 5).setOrigin(0));
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
      { tex: can ? 'btn-gold-90' : 'btn-90', down: can ? 'btn-gold-90-down' : 'btn-90-down', color: can ? COL.k : COL.v, depth: DEPTH.hud },
    );
    this.layer.push(b.img, b.label);
    if (cost !== null) this.add2(this.add.image(84, y + 45, 'icon-soul').setDepth(DEPTH.hud + 2));
  }

  // ================================================================ mercado

  private renderMarket() {
    if (!meta.market.length) this.text(90, 120, 'estoque vazio. renove ou jogue uma run.', COL.B).setOrigin(0.5);
    meta.market.forEach((id, i) => {
      const it = ITEM_BY_ID[id];
      if (!it) return;
      const x = 5;
      const y = 22 + i * 46;
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
      264 + GROW,
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
    this.text(90, 278 + GROW, 'o estoque muda a cada run', COL.B).setOrigin(0.5, 0);
  }

  // ================================================================ arsenal

  private renderArsenal() {
    const counts = schoolCounts(schoolBonus(meta));

    // boneco em cruz com os 6 espaços (como no King Dies Rich)
    this.add2(this.add.nineslice(4, 37, 'card', undefined, 76, 77, 6, 6, 6, 6).setOrigin(0));
    for (const slot of EQUIP_SLOTS) {
      const [x, y] = DOLL[slot];
      const id = meta.equipped[slot];
      const it = id ? ITEM_BY_ID[id] : undefined;
      const frame = this.add2(this.add.image(x, y, it ? `slot-${it.rarity}` : 'slot-empty').setInteractive({ useHandCursor: true }));
      if (it && id) {
        this.add2(this.add.image(x, y, `item-${id}`).setScale(2));
        this.schoolBadge(it, x + 10, y - 10);
      } else this.add2(this.add.image(x, y, `slot-sil-${SLOT_OF[slot]}`));
      const sl = meta.slots[slot] ?? 0;
      if (sl > 0) this.text(x - 10, y + 4, `+${sl}`, COL.O);
      if (bagFilter.slot === slot) this.add2(this.add.graphics().lineStyle(1, COL.U, 1).strokeRect(x - 12.5, y - 12.5, 25, 25));
      frame.on('pointerdown', () => {
        audio.play('click');
        // toque no espaço filtrado e vazio: limpa o filtro
        bagFilter.slot = bagFilter.slot === slot && !id ? null : slot;
        bagScroll.y = 0;
        this.selected = id ?? null;
        this.render(false);
      });
    }

    // escolas equipadas: marcadores com os degraus (maestria, domínio, apoteose); tocar abre o popup da escola
    this.add2(this.add.nineslice(84, 37, 'card', undefined, 92, 77, 6, 6, 6, 6).setOrigin(0));
    this.text(90, 42, 'ESCOLAS', COL.U, true);
    SCHOOL_ORDER.forEach((sc, i) => {
      const y = 55 + i * 11;
      const n = counts[sc];
      const info = SCHOOLS[sc];
      const col = hex(info.color);
      this.add2(this.add.image(93, y + 2, `school-${sc}`).setAlpha(n > 0 ? 1 : 0.35));
      this.text(100, y, info.name, n > 0 ? col : COL.B);
      this.pips(this.add2(this.add.graphics()), 139, y, n, col);
      this.add2(this.add.zone(86, y - 2, 88, 11).setOrigin(0).setInteractive({ useHandCursor: true })).on('pointerdown', () => {
        audio.play('click');
        this.schoolSel = sc;
        this.render(false);
      });
    });

    // mochila: agrupada por escola, com os marcadores de cada uma; arrasta para rolar
    const equippedIds = new Set(Object.values(meta.equipped));
    const filter = bagFilter.slot ? SLOT_OF[bagFilter.slot] : null;
    const collected = ITEMS.filter((i) => i.id in meta.items);
    const owned = collected.filter((i) => !equippedIds.has(i.id) && (!filter || i.slot === filter));
    const head = this.text(6, BAG_TOP - 10, 'MOCHILA', COL.v, true);
    if (filter) {
      // chip do filtro: toque para ver tudo
      const chip = this.text(head.x + head.width + 6, BAG_TOP - 10, `${SLOT_PLURAL[filter]} x`, COL.U);
      this.add2(this.add.zone(chip.x - 3, BAG_TOP - 14, chip.width + 8, 14).setOrigin(0).setInteractive({ useHandCursor: true })).on('pointerdown', () => {
        audio.play('click');
        bagFilter.slot = null;
        bagScroll.y = 0;
        this.render(false);
      });
    }
    this.text(174, BAG_TOP - 10, `${collected.length}/${ITEMS.length}`, COL.B).setOrigin(1, 0);
    const bag = this.add.container(0, BAG_TOP + bagScroll.y);
    this.add2(bag);
    this.map = bag;
    const mask = this.make.graphics({}, false).fillRect(0, BAG_TOP, 180, BAG_BOTTOM - BAG_TOP);
    bag.setMask(mask.createGeometryMask());
    this.layer.push(mask);
    let y = 2;
    if (!owned.length) {
      const msg = filter ? `nenhum outro ${SLOT_NAME[filter].toLowerCase()} na mochila` : collected.length ? 'tudo o que você tem está equipado' : 'mate elites e chefes, ou compre no mercado';
      bag.add(pxText(this, 90, 30, wrap(msg, 36), COL.B).setOrigin(0.5, 0).setCenterAlign());
    }
    for (const grp of BAG_GROUPS) {
      const items = owned.filter(grp.has);
      if (!items.length) continue;
      if (grp.school) bag.add(this.add.image(9, y + 2, `school-${grp.school}`));
      bag.add(pxText(this, grp.school ? 16 : 6, y, grp.name.toUpperCase(), grp.color, false, true));
      if (grp.school) {
        const g = this.add.graphics();
        this.pips(g, 139, y, counts[grp.school], grp.color);
        bag.add(g);
      }
      y += 10;
      items.forEach((it, i) => {
        const x = 15 + (i % 7) * 25;
        const iy = y + 12 + Math.floor(i / 7) * 26;
        bag.add(this.add.image(x, iy, `slot-${it.rarity}`));
        bag.add(this.add.image(x, iy, `item-${it.id}`).setScale(2));
        const lvl = meta.items[it.id] ?? 0;
        if (lvl) bag.add(pxCount(this, x + 11, iy + 4, `${lvl}`, COL.y).setOrigin(1, 0));
        // acabou de voltar do boneco: pisca a moldura
        if (it.id === this.flashId) {
          const ring = this.add.graphics().lineStyle(1, COL.U, 1).strokeRect(x - 11.5, iy - 11.5, 23, 23);
          bag.add(ring);
          this.tweens.add({ targets: ring, alpha: 0, duration: 220, yoyo: true, repeat: 3, onComplete: () => ring.destroy() });
        }
        this.schoolBadge(it, x + 10, iy - 10, bag);
        const hit = this.add.zone(x, iy, 24, 24).setInteractive({ useHandCursor: true });
        bag.add(hit);
        hit.on('pointerup', (pt: Phaser.Input.Pointer) => {
          if (this.treeDrag?.moved || pt.worldY < BAG_TOP || pt.worldY > BAG_BOTTOM) return;
          audio.play('click');
          buzz('light');
          this.selected = it.id;
          this.render(false);
        });
      });
      y += Math.ceil(items.length / 7) * 26 + 6;
    }
    this.bagHeight = y;
    this.flashId = null;
    if (this.selected && this.selected in meta.items) this.renderDetail(this.selected);
    else if (this.schoolSel) this.renderSchool(this.schoolSel);
  }

  /** Equipar subiu uma escola de degrau: partículas na linha dela e um aviso com o nome do degrau. */
  private celebrateTiers(before: Record<School, number>, after: Record<School, number>) {
    SCHOOL_ORDER.forEach((sc, i) => {
      const t = schoolTier(after[sc]);
      if (t <= schoolTier(before[sc])) return;
      const info = SCHOOLS[sc];
      const name = t === 3 ? info.apotheosisName : t === 2 ? info.dominionName : 'maestria';
      this.time.delayedCall(60, () => {
        const col = hex(info.color);
        this.success(158, 57 + i * 11, [col, 0xffffff]);
        if (t >= 2) this.shaker.add(t === 3 ? 0.6 : 0.35);
        audio.play('synergy');
        buzz('heavy');
        this.toast(`${info.name.toLowerCase()}: ${TIER_NAME[t]}${t >= 2 ? ` (${name.toLowerCase()})` : ''}!`);
      });
    });
  }

  /** Popup da escola: o efeito de cada degrau (1, 2, 4 e 6 itens), aceso até onde você chegou. */
  private renderSchool(sc: School) {
    const info = SCHOOLS[sc];
    const n = schoolCounts(schoolBonus(meta))[sc];
    const col = hex(info.color);
    const D = DEPTH.modal;
    const close = () => {
      this.schoolSel = null;
      this.render(false);
    };
    this.add2(this.add.rectangle(0, screenTop(this.scene.key), 180, VIEW_H, 0x0b0806, 0.78).setOrigin(0).setDepth(D).setInteractive()).on('pointerdown', close);
    const box = this.add2(this.add.container(0, 0).setDepth(D + 1));
    const panel = this.add.nineslice(8, 0, 'card-gold', undefined, 164, 40, 6, 6, 6, 6).setOrigin(0).setInteractive();
    box.add(panel);
    box.add(this.add.image(20, 13, `school-${sc}`));
    box.add(pxText(this, 28, 9, info.name.toUpperCase(), col, false, true));
    box.add(pxText(this, 165, 9, `${n}/${APOTHEOSIS_AT}`, COL.v).setOrigin(1, 0));
    let y = 26;
    const steps: [number, string, string][] = [
      [BASE_AT, 'básico', info.base],
      [MASTERY_AT, 'maestria', info.mastery],
      [DOMINION_AT, info.dominionName.toLowerCase(), info.dominion],
      [APOTHEOSIS_AT, info.apotheosisName.toLowerCase(), info.apotheosis],
    ];
    for (const [at, name, text] of steps) {
      const on = n >= at;
      box.add(this.add.rectangle(15, y, 2, 2, on ? col : 0x3a2c22).setOrigin(0));
      box.add(pxText(this, 20, y - 2, `${at} · ${name.toUpperCase()}`, on ? col : COL.B));
      const t = pxText(this, 20, y + 8, wrap(text, 36), on ? COL.u : COL.B);
      box.add(t);
      y += t.height + 16;
    }
    box.add(pxText(this, 90, y - 6, 'toque fora para fechar', COL.B).setOrigin(0.5, 0));
    panel.setSize(164, y + 6);
    box.y = Math.round((VIEW_H - (y + 6)) / 2);
  }

  /** Marcadores de escola: ■◆■◆■◆ (o losango marca maestria, domínio e apoteose), acesos até `n`. */
  private pips(g: Phaser.GameObjects.Graphics, x: number, y: number, n: number, col: number) {
    for (let k = 0; k < APOTHEOSIS_AT; k++) {
      const px = x + k * 6;
      const on = k < n;
      const step = k + 1 === MASTERY_AT || k + 1 === DOMINION_AT || k + 1 === APOTHEOSIS_AT;
      if (step) {
        // losango 5x5
        g.fillStyle(on ? col : 0x3a2c22);
        g.fillRect(px + 2, y, 1, 5).fillRect(px + 1, y + 1, 3, 3).fillRect(px, y + 2, 5, 1);
        if (!on) g.fillStyle(0x0b0806).fillRect(px + 2, y + 2, 1, 1);
      } else {
        g.fillStyle(on ? col : 0x3a2c22).fillRect(px, y + 1, 4, 4);
        if (!on) g.fillStyle(0x0b0806).fillRect(px + 1, y + 2, 2, 2);
      }
    }
  }

  /** ícone da escola no canto do item (conjuntos mostram as duas) */
  private schoolBadge(it: Item, x: number, y: number, parent?: Phaser.GameObjects.Container) {
    Object.keys(it.school ?? {}).forEach((sc, i) => {
      const img = this.add.image(x - i * 9, y, `badge-${sc}`);
      if (parent) parent.add(img);
      else this.add2(img);
    });
  }

  /**
   * Popup do item (como no King Dies Rich): nome, raridade e nível, caixas com o que melhora e piora,
   * o efeito com a barra da escola, ganhos e perdas de escola, e os botões.
   */
  private renderDetail(id: string) {
    const it = ITEM_BY_ID[id];
    const lvl = meta.items[id] ?? 0;
    const slot = slotOfItem(meta, id);
    const slotLvl = slot ? (meta.slots[slot] ?? 0) : 0;
    const D = DEPTH.modal;
    const X0 = 8;
    const W = 164;
    const close = () => {
      this.selected = null;
      this.render(false);
    };
    this.add2(this.add.rectangle(0, screenTop(this.scene.key), 180, VIEW_H, 0x0b0806, 0.78).setOrigin(0).setDepth(D).setInteractive()).on('pointerdown', close);
    // tudo dentro de um container, que no fim desce para centralizar o popup
    const box = this.add2(this.add.container(0, 0).setDepth(D + 1));
    const panel = this.add.nineslice(X0, 0, 'card-gold', undefined, W, 40, 6, 6, 6, 6).setOrigin(0).setInteractive();
    box.add(panel);
    const put = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      box.add(o);
      return o;
    };
    const txt = (x: number, y: number, t: string, c: number, wide = false) => put(pxText(this, x, y, t, c, false, wide));
    let y = 8;
    // ícone e nome
    put(this.add.image(X0 + 17, y + 10, `slot-${it.rarity}`));
    put(this.add.image(X0 + 17, y + 10, `item-${id}`).setScale(2));
    const title = txt(X0 + 33, y, wrap(it.name.toUpperCase(), 20), COL.U, true);
    const x = put(pxText(this, X0 + W - 7, y - 3, 'x', COL.v, false, true).setOrigin(1, 0));
    put(this.add.zone(X0 + W - 9, y + 2, 18, 18).setInteractive({ useHandCursor: true })).on('pointerdown', close);
    void x;
    y += Math.max(22, title.height + 4);
    txt(X0 + 7, y, RARITY_NAME[it.rarity], hex(RARITY_COLOR[it.rarity]), true);
    txt(X0 + W - 7, y, `nível ${lvl}/${MAX_ITEM_LEVEL}${slotLvl ? ` +${slotLvl}` : ''}`, COL.v, true).setOrigin(1, 0);
    y += 12;

    // caixas: os dois números que mais mudam
    const deltas = compareEquip(id);
    const stats = deltas.filter((d) => d.kind === 'stat').slice(0, 2);
    stats.forEach((d, i) => {
      const bw = stats.length === 1 ? W - 14 : (W - 17) / 2;
      const bx = X0 + 7 + i * (bw + 3);
      put(this.add.nineslice(bx, y, d.good ? 'box-good' : 'box-bad', undefined, bw, 26, 4, 4, 4, 4).setOrigin(0));
      txt(bx + 5, y + 5, d.name ?? '', COL.v);
      txt(bx + 5, y + 14, d.value ?? '', d.good ? COL.G : COL.R, true);
    });
    if (stats.length) y += 31;

    // efeito, com a barra da escola (ou da raridade)
    const sc = Object.keys(it.school ?? {})[0] as School | undefined;
    const barCol = sc ? hex(SCHOOLS[sc].color) : hex(RARITY_COLOR[it.rarity]);
    const eff = txt(X0 + 12, y, wrap(it.desc(effectiveLevel(lvl, slotLvl)), 36), COL.u);
    put(this.add.rectangle(X0 + 7, y - 1, 2, eff.height + 1, barCol).setOrigin(0));
    y += eff.height + 6;
    if (it.set) {
      const set = SET_BY_ID[it.set];
      const n = EQUIP_SLOTS.filter((sl) => ITEM_BY_ID[meta.equipped[sl] ?? '']?.set === it.set).length;
      txt(X0 + 7, y, `conjunto ${set.name.toLowerCase()} ${n}/3`, hex(set.color));
      y += 10;
    } else if (it.hoard) {
      txt(X0 + 7, y, wrap(`tesouro: ${it.hoard.desc(lvl)}`, 38), COL.O);
      y += 10;
    }

    // ganhos e perdas de escola (e de tipos de morto)
    const gains = deltas.filter((d) => d.kind === 'change' && d.good).map((d) => d.text);
    const losses = deltas.filter((d) => d.kind === 'change' && !d.good).map((d) => d.text);
    for (const [label, list, col] of [
      ['ganhos:', gains, COL.G],
      ['perdas:', losses, COL.R],
    ] as const) {
      if (!list.length) continue;
      txt(X0 + 7, y, label, col);
      const t = txt(X0 + 40, y, wrap(list.join(', '), 28), COL.u);
      y += t.height + 4;
    }
    put(this.add.rectangle(X0 + 7, y + 1, W - 14, 1, COL.y, 0.2).setOrigin(0));
    y += 6;

    // botões: equipar (cheio) e forjar o espaço (contorno)
    const eq = button(
      this,
      90,
      y + 10,
      slot ? 'TIRAR' : 'EQUIPAR',
      () => {
        if (slot) {
          unequip(meta, slot);
          this.flashId = id;
        } else {
          const target = targetSlot(id);
          const old = meta.equipped[target];
          const before = schoolCounts(schoolBonus(meta));
          equip(meta, id, target);
          if (old && old !== id) {
            this.flashId = old;
            this.toast(`${ITEM_BY_ID[old].name.toLowerCase()} voltou para a mochila`);
          }
          this.celebrateTiers(before, schoolCounts(schoolBonus(meta)));
        }
        saveMeta();
        audio.play('fuse');
        buzz('medium');
        this.shaker.add(0.15);
        this.selected = null;
        this.render(false);
      },
      { tex: slot ? 'btn-modal' : 'btn-modal-red', down: slot ? 'btn-modal-down' : 'btn-modal-red-down', color: COL.u, depth: D + 2 },
    );
    y += 24;
    const cost = slot ? slotForgeCost(meta, slot) : null;
    const label = !slot ? 'EQUIPE PARA FORJAR' : cost === null ? 'ESPAÇO NO MÁXIMO' : `FORJAR ESPAÇO ${fmt(cost)}`;
    const can = !!slot && cost !== null && meta.souls >= cost;
    const fg = button(
      this,
      90,
      y + 9,
      label,
      () => {
        if (slot && forgeSlot(meta, slot)) {
          this.success(90, y + 9, [COL.O, COL.y, 0xffffff]);
          audio.play('slam');
          this.shaker.add(0.35);
          this.toast(`espaço ${SLOT_NAME[SLOT_OF[slot]].toLowerCase()} agora é +${meta.slots[slot]}`);
          this.render(false);
        } else this.fail(fg.img);
      },
      { tex: 'btn-modal-line', down: 'btn-modal-down', color: can ? COL.O : COL.B, depth: D + 2 },
    );
    box.add([eq.img, eq.label, fg.img, fg.label]);
    y += 24;

    // centraliza o popup na tela
    panel.setSize(W, y);
    box.y = Math.round((320 + GROW - y) / 2);
  }

  // ================================================================ altar (gemas)

  /**
   * Altar das gemas, no princípio do King Dies Rich: em cima os encaixes; embaixo um catálogo com uma casa
   * fixa para cada gema possível (colunas = tipo, linhas = nível). O nível é a forma da gema, não um número;
   * a que falta aparece como silhueta escura e a quantidade fica no canto, com contorno.
   */
  private renderAltar() {
    const active = meta.sockets.map((k) => (k ? parseGem(k) : null)).filter((g) => g !== null);
    const effects = active.length ? active.map((g) => cap(GEMS[g.type].desc(g.rank))) : ['toque numa gema e de novo para encaixar'];
    const effTop = 86;
    const altarH = effTop - 38 + effects.length * 8 + 4;

    // ---- encaixes
    this.add2(this.add.nineslice(5, 38, 'item-card', undefined, 170, altarH, 5, 5, 5, 5).setOrigin(0));
    this.text(11, 43, 'gemas do altar', COL.v, true);
    const n = meta.sockets.length;
    meta.sockets.forEach((key, i) => {
      const x = 90 + (i - (n - 1) / 2) * 32;
      const y = 66;
      const g = key ? parseGem(key) : null;
      const frame = this.add2(this.add.image(x, y, g ? 'socket-on' : 'socket').setInteractive({ useHandCursor: true }));
      if (g) this.add2(this.add.image(x, y, `gem-${g.type}-${g.rank}`));
      frame.on('pointerdown', () => {
        if (unsocketGem(meta, i)) {
          this.success(x, y, [hex(GEMS[g!.type].color)]);
          this.render(false);
        } else this.fail(frame);
      });
    });
    this.text(90, effTop, effects.join('\n'), active.length ? COL.G : COL.B).setOrigin(0.5, 0).setCenterAlign();

    // ---- catálogo: 5 tipos x 5 níveis
    const top = 38 + altarH + 4;
    this.add2(this.add.nineslice(5, top, 'item-card', undefined, 170, 272 + GROW - 14 - top, 5, 5, 5, 5).setOrigin(0));
    this.text(11, top + 5, 'bolsa', COL.v, true);
    const owned = Object.values(meta.gems).reduce((a, b) => a + b, 0);
    this.text(169, top + 5, `${owned}`, COL.B).setOrigin(1, 0);
    const colX = (c: number) => 30 + c * 30;
    const rowY = (r: number) => top + 24 + (r - 1) * 20;
    const sel = this.selectedGem && (meta.gems[this.selectedGem] ?? 0) > 0 ? this.selectedGem : null;
    GEM_TYPES.forEach((type, c) => {
      for (let r = 1; r <= MAX_GEM_RANK; r++) {
        const k = gemKey(type, r);
        const count = meta.gems[k] ?? 0;
        const x = colX(c);
        const y = rowY(r);
        const cell = this.add2(this.add.image(x, y, count ? 'gcell-on' : 'gcell').setInteractive({ useHandCursor: true }));
        const icon = this.add2(this.add.image(x, y, `gem-${type}-${r}`));
        // a que falta: silhueta escura da própria gema
        if (!count) icon.setTint(0x262626).setAlpha(0.9);
        else this.add2(pxCount(this, x + 10, y + 3, `${count}`, count >= 3 && r < MAX_GEM_RANK ? COL.y : COL.w).setOrigin(1, 0));
        if (k === sel) this.add2(this.add.graphics().lineStyle(1, COL.U, 1).strokeRect(x - 9.5, y - 9.5, 19, 19));
        cell.on('pointerdown', () => {
          if (!count) {
            this.toast(`${GEMS[type].name.toLowerCase()} ${GEM_RANK_TITLE[r]}: ainda não tem`);
            return this.fail(cell);
          }
          if (k !== sel) {
            audio.play('click');
            buzz('light');
            this.selectedGem = k;
            this.render(false);
            return;
          }
          if (!meta.sockets.includes(null)) {
            this.toast('altar cheio: toque numa gema do altar para tirar');
            return this.fail(cell);
          }
          socketGem(meta, k);
          this.selectedGem = null;
          this.success(x, y, [hex(GEMS[type].color), 0xffffff]);
          this.render(false);
        });
      }
    });
    // o que a gema escolhida faz (ou de onde elas vêm)
    const infoY = rowY(MAX_GEM_RANK) + 13;
    if (sel) {
      const g = parseGem(sel)!;
      this.text(90, infoY, `${GEMS[g.type].name} ${GEM_RANK_TITLE[g.rank]}`, hex(GEMS[g.type].color), true).setOrigin(0.5, 0);
      this.text(90, infoY + 9, wrap(`${GEMS[g.type].desc(g.rank)}. toque de novo para encaixar`, 40), COL.u).setOrigin(0.5, 0).setCenterAlign();
    } else this.text(90, infoY, wrap('gemas caem de elites e chefes. 3 iguais viram 1 melhor', 40), COL.B).setOrigin(0.5, 0).setCenterAlign();

    const merge = button(
      this,
      90,
      272 + GROW,
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
  }

  // ================================================================ tesouro

  private renderHoard() {
    const hoard = HOARD_ITEMS();
    const owned = hoard.filter((it) => it.id in meta.items);
    this.text(90, 36, `${owned.length} de ${hoard.length} encontrados`, COL.U).setOrigin(0.5, 0);
    const g = this.add2(this.add.graphics());

    // nicho em arco com pedestais (como o salão do tesouro do king dies rich)
    const alcove = (x: number, y: number, w: number, h: number, banner: string, items: typeof hoard) => {
      // nicho de pedra em arco (textura do gerador)
      this.add2(this.add.image(x, y, `alcove-${w}x${h}`).setOrigin(0));
      // estandarte pendurado numa haste de ferro, com a ponta em V
      const bc = hex(banner);
      const bx = Math.round(x + w / 2);
      g.fillStyle(0x0b0806, 1).fillRect(bx - 6, y - 5, 12, 2);
      g.fillStyle(0x8a94a6, 1).fillRect(bx - 6, y - 5, 12, 1);
      g.fillStyle(bc, 1).fillRect(bx - 4, y - 3, 8, 9);
      g.fillStyle(0xffffff, 0.25).fillRect(bx - 4, y - 3, 1, 9);
      g.fillStyle(0x000000, 0.3).fillRect(bx + 3, y - 3, 1, 9);
      g.fillStyle(0x0d0907, 1).fillTriangle(bx - 4, y + 7, bx + 4, y + 7, bx, y + 3);
      const step = (w - 8) / items.length;
      items.forEach((it, i) => {
        const px = Math.round(x + 4 + step * (i + 0.5));
        const py = y + h - 8;
        // pedestal de pedra com a cor do estandarte numa faixa
        this.add2(this.add.image(px, py + 1, 'pedestal').setOrigin(0.5, 0));
        g.fillStyle(bc, 0.7).fillRect(px - 4, py + 4, 8, 1);
        const have = it.id in meta.items;
        const icon = this.add2(this.add.image(px, py - 8, `item-${it.id}`).setInteractive({ useHandCursor: true }));
        if (!have) icon.setTintFill(0x3a2a1e).setAlpha(0.8);
        else {
          if (meta.items[it.id]) this.add2(pxCount(this, px + 5, py - 6, `${meta.items[it.id]}`, COL.y));
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
    // estandartes e faixas dos pedestais por cima da pedra dos nichos
    this.children.bringToTop(g);
    SETS.forEach((set, i) => this.text(31 + i * 58, 152, set.name.toLowerCase().split(' ')[0], hex(set.color)).setOrigin(0.5, 0));

    // bônus somados, num cartão; o item tocado substitui a lista
    const sel0 = this.selected ? ITEM_BY_ID[this.selected] : null;
    const done = owned.length === hoard.length;
    if (!sel0?.hoard) {
      const lines = owned.map((it) => `• ${cap(it.hoard!.desc(meta.items[it.id]))}`);
      this.add2(this.add.nineslice(5, 164, 'item-card', undefined, 170, 92, 5, 5, 5, 5).setOrigin(0));
      this.text(11, 170, 'BÔNUS DO TESOURO', COL.U, true);
      this.text(11, 182, lines.length ? lines.slice(0, 6).join('\n') + (lines.length > 6 ? `\n+${lines.length - 6} bônus` : '') : wrap('nada ainda: relíquias caem raramente dos chefes de cada cerco', 40), lines.length ? COL.G : COL.B);
    }
    this.text(90, 262 + GROW, done ? `completo: ${HOARD_COMPLETE.desc}` : `completo dá: ${HOARD_COMPLETE.desc}`, done ? COL.y : COL.B).setOrigin(0.5, 0);
    const sel = this.selected ? ITEM_BY_ID[this.selected] : null;
    if (sel?.hoard) {
      const have = sel.id in meta.items;
      const set = sel.set ? SET_BY_ID[sel.set] : null;
      this.add2(this.add.nineslice(5, 164, 'item-card', undefined, 170, 92, 5, 5, 5, 5).setOrigin(0));
      this.add2(this.add.nineslice(26, 186, `slot-${sel.rarity}`, undefined, 26, 26, 4, 4, 4, 4));
      const big = this.add2(this.add.image(26, 186, `item-${sel.id}`).setScale(2));
      if (!have) big.setTintFill(0x3a2a1e);
      this.text(11, 170, have ? sel.name.toUpperCase() : '???', hex(RARITY_COLOR[sel.rarity]), true);
      this.text(44, 182, have ? 'na sua coleção' : sel.region !== undefined ? `cai em ${REGIONS[sel.region].name.toLowerCase()}` : '??? (não encontrado)', hex(RARITY_COLOR[sel.rarity]));
      this.text(44, 192, wrap(`tesouro: ${sel.hoard.desc(meta.items[sel.id] ?? 0)}`, 30), COL.u);
      if (set) {
        this.text(11, 214, `conjunto ${set.name.toLowerCase()}`, hex(set.color));
        this.text(11, 224, wrap(`2 peças: ${set.two}`, 42), COL.v);
        this.text(11, 240, wrap(`3 peças: ${set.three}`, 42).split('\n')[0], COL.v);
      }
    }
  }

  private toast(text: string) {
    const t = pxText(this, 90, 282 + GROW, text, COL.y).setOrigin(0.5).setDepth(DEPTH.hud);
    this.tweens.add({ targets: t, alpha: 0, y: 278 + GROW, delay: 1200, duration: 300, onComplete: () => t.destroy() });
  }

  update(_t: number, delta: number) {
    this.shaker.update(delta / 1000);
    if (this.shownSouls !== meta.souls) {
      this.shownSouls += Math.sign(meta.souls - this.shownSouls) * Math.max(1, Math.round(Math.abs(meta.souls - this.shownSouls) * 0.2));
      this.nav.setSouls(this.shownSouls);
    }
  }
}
