import type { MetaState } from './meta';
import type { Mods } from './mods';

/**
 * Árvore da Necrópole: substitui as construções do cemitério.
 * 6 ramos, cada um com nós em 3 camadas e uma Coroa. Desenho e balanço em docs/ARVORE.md.
 */
export type BranchId = 'criptas' | 'ossuario' | 'biblioteca' | 'altar' | 'sino' | 'relicario';

export interface TreeNode {
  id: string;
  branch: BranchId;
  /** 1..3 = camadas, 4 = coroa */
  tier: 1 | 2 | 3 | 4;
  name: string;
  max: number;
  /** texto do efeito por nível */
  per: string;
  apply: (m: Mods, lvl: number) => void;
}

export interface Branch {
  id: BranchId;
  name: string;
  desc: string;
  color: string;
  icon: string;
}

export const BRANCHES: Branch[] = [
  { id: 'criptas', name: 'Criptas', desc: 'o exército', color: '#5fd08a', icon: 'b-crypt' },
  { id: 'ossuario', name: 'Ossuário', desc: 'o corpo dos mortos', color: '#e3dccb', icon: 'b-ossuary' },
  { id: 'biblioteca', name: 'Biblioteca', desc: 'raios, círculo e ritual', color: '#8fd3ff', icon: 'b-library' },
  { id: 'altar', name: 'Altar de Sangue', desc: 'vida e explosões', color: '#e0304a', icon: 'b-altar' },
  { id: 'sino', name: 'Torre do Sino', desc: 'saque, eventos e mercador', color: '#f6cf6a', icon: 'b-bell' },
  { id: 'relicario', name: 'Relicário', desc: 'almas, itens e gemas', color: '#c08ae0', icon: 'b-reliquary' },
];

export const BRANCH_BY_ID = Object.fromEntries(BRANCHES.map((b) => [b.id, b])) as Record<BranchId, Branch>;

const n = (id: string, branch: BranchId, tier: TreeNode['tier'], name: string, max: number, per: string, apply: TreeNode['apply']): TreeNode => ({
  id,
  branch,
  tier,
  name,
  max,
  per,
  apply,
});

export const TREE: TreeNode[] = [
  // ------------------------------------------------ Criptas
  n('nichos', 'criptas', 1, 'Nichos', 5, '+4 no limite do exército', (m, l) => (m.armyCap += 4 * l)),
  n('covas_rasas', 'criptas', 1, 'Covas Rasas', 5, '+2 esqueletos no início', (m, l) => (m.startSkeletons += 2 * l)),
  n('terra_fria', 'criptas', 1, 'Terra Fria', 3, 'cadáveres duram +1s', (m, l) => (m.corpseLife += l)),
  n('rito_ligeiro', 'criptas', 2, 'Rito Ligeiro', 5, 'levantar 6% mais rápido', (m, l) => (m.raiseTimeMul *= 1 - 0.06 * l)),
  n('vigilia', 'criptas', 2, 'Vigília', 3, '+1 esqueleto grátis por onda', (m, l) => (m.freeSkeletonsPerWave += l)),
  n('marcha', 'criptas', 2, 'Marcha Fúnebre', 3, 'mortos +4% velocidade', (m, l) => (m.deadSpeedMul *= 1 + 0.04 * l)),
  n('catacumbas', 'criptas', 3, 'Catacumbas', 5, '+5 no limite do exército', (m, l) => (m.armyCap += 5 * l)),
  n('covas_gemeas', 'criptas', 3, 'Covas Gêmeas', 3, '5% de chance de um cadáver levantar 2', (m, l) => (m.doubleRaiseChance += 0.05 * l)),
  n('necropole_viva', 'criptas', 4, 'Necrópole Viva', 1, 'cada região começa com +10 esqueletos; limite +10', (m) => {
    m.regionSkeletons += 10;
    m.armyCap += 10;
  }),
  // ------------------------------------------------ Ossuário
  n('medula', 'ossuario', 1, 'Medula', 5, 'mortos +6% vida', (m, l) => (m.deadHpMul *= 1 + 0.06 * l)),
  n('ossos_afiados', 'ossuario', 1, 'Ossos Afiados', 5, 'mortos +5% dano', (m, l) => (m.deadDmgMul *= 1 + 0.05 * l)),
  n('placas', 'ossuario', 2, 'Placas de Osso', 3, 'mortos ignoram 4% do dano', (m, l) => (m.deadArmor = 1 - (1 - m.deadArmor) * (1 - 0.04 * l))),
  n('colosso', 'ossuario', 2, 'Colosso', 3, 'colossos +15% vida e dano', (m, l) => (m.giantMul *= 1 + 0.15 * l)),
  n('restos', 'ossuario', 2, 'Restos Teimosos', 3, '5% de chance do morto caído voltar como ossos', (m, l) => (m.boneRebirth += 0.05 * l)),
  n('mortos_elite', 'ossuario', 3, 'Mortos de Elite', 3, '3% dos levantados nascem elite', (m, l) => (m.eliteRaise += 0.03 * l)),
  n('osso_profano', 'ossuario', 3, 'Osso Profano', 3, 'dano sagrado contra mortos -10%', (m, l) => (m.holyResist += 0.1 * l)),
  n('trono_ossos', 'ossuario', 4, 'Trono de Ossos', 1, 'mortos +15% vida e dano; campeão +20%', (m) => {
    m.deadHpMul *= 1.15;
    m.deadDmgMul *= 1.15;
    m.championMul *= 1.2;
  }),
  // ------------------------------------------------ Biblioteca Proibida
  n('leitura', 'biblioteca', 1, 'Leitura Rápida', 5, 'raios 4% mais rápidos', (m, l) => (m.castCdMul *= 1 - 0.04 * l)),
  n('circulo', 'biblioteca', 1, 'Círculo Gravado', 5, 'círculo +1 de raio', (m, l) => (m.circleR += l)),
  n('palavras', 'biblioteca', 2, 'Palavras de Poder', 3, 'raios +5 de dano', (m, l) => (m.necroDmg += 0.5 * l)),
  n('eco', 'biblioteca', 2, 'Eco', 2, 'raios saltam para +1 alvo', (m, l) => (m.boltChain += l)),
  n('liturgia', 'biblioteca', 3, 'Liturgia', 5, 'o ritual precisa de 6% menos abates', (m, l) => (m.ritualMul *= 1 - 0.06 * l)),
  n('rito_duplo', 'biblioteca', 3, 'Rito Duplo', 3, '8% de chance de o ritual não gastar a carga', (m, l) => (m.ritualKeep += 0.08 * l)),
  n('grimorio', 'biblioteca', 4, 'Grimório Final', 1, 'raios +1 salto; círculo +4', (m) => {
    m.boltChain += 1;
    m.circleR += 4;
  }),
  // ------------------------------------------------ Altar de Sangue
  n('sangue_velho', 'altar', 1, 'Sangue Velho', 5, '+40 de vida do necromante', (m, l) => (m.necroMaxHp += 4 * l)),
  n('banquete', 'altar', 1, 'Banquete', 3, 'consumir cura +20%', (m, l) => (m.consumeHealMul *= 1 + 0.2 * l)),
  n('coracao', 'altar', 2, 'Coração Lento', 3, 'regenera 10 de vida a cada 20s / 14s / 10s', (m, l) => (m.necroRegen += [0, 1 / 20, 1 / 14, 1 / 10][l])),
  n('carne_volatil', 'altar', 2, 'Carne Volátil', 5, 'explosões +8% dano', (m, l) => (m.explodeDmgMul *= 1 + 0.08 * l)),
  n('estilhacos', 'altar', 2, 'Estilhaços', 3, 'explosões +2 de raio', (m, l) => (m.explodeR += 2 * l)),
  n('furia', 'altar', 3, 'Fúria Ritual', 3, 'sacrifícios dão +10% de dano aos mortos por 4s', (m, l) => {
    m.frenzyDmg += 0.1 * l;
    m.frenzyTime = Math.max(m.frenzyTime, 4);
  }),
  n('martir', 'altar', 3, 'Mártir', 3, 'explodir tem 6% de chance de não gastar o morto', (m, l) => (m.explodeKeep = Math.max(m.explodeKeep, 0.06 * l))),
  n('imortal', 'altar', 4, 'Imortal', 1, 'uma vez por run, ao cair, volta com metade da vida (gasta metade do exército)', (m) => (m.revive = true)),
  // ------------------------------------------------ Torre do Sino
  n('badalo', 'sino', 1, 'Badalo', 5, 'itens que caem um pouco mais raros', (m, l) => (m.itemLuck += 0.06 * l)),
  n('repique', 'sino', 1, 'Repique', 3, 'elites derrubam item 4% mais', (m, l) => (m.eliteLootBonus += 0.04 * l)),
  n('pacto_antigo', 'sino', 2, 'Pacto Antigo', 3, 'relíquias 15% mais prováveis', (m, l) => (m.relicLuck *= 1 + 0.15 * l)),
  n('mapa', 'sino', 2, 'Mapa Roubado', 1, 'a encruzilhada oferece 3 rotas', (m) => (m.routeChoices = 3)),
  n('augurio', 'sino', 2, 'Augúrio', 2, 'eventos aparecem 15% mais', (m, l) => (m.eventChance *= 1 + 0.15 * l)),
  n('sino_prata', 'sino', 3, 'Sino de Prata', 3, 'itens que caem bem mais raros', (m, l) => (m.itemLuck += 0.12 * l)),
  n('contrabando', 'sino', 3, 'Contrabando', 3, 'mercador 10% mais barato; nível 3: +1 item', (m, l) => {
    m.merchantDiscount += 0.1 * l;
    if (l >= 3) m.merchantExtra += 1;
  }),
  n('sino_mortos', 'sino', 4, 'Sino dos Mortos', 1, 'relíquias 2x mais prováveis; chefes sempre derrubam item raro', (m) => {
    m.relicLuck *= 2;
    m.bossRareLoot = true;
  }),
  // ------------------------------------------------ Relicário
  n('dizimo', 'relicario', 1, 'Dízimo', 5, '+6% almas', (m, l) => (m.soulMul += 0.06 * l)),
  n('salao', 'relicario', 1, 'Salão dos Campeões', 3, 'nível 1 libera o campeão; 2 e 3: +20% força', (m, l) => (m.championMul *= 1 + 0.2 * Math.max(0, l - 1))),
  n('faro', 'relicario', 2, 'Faro', 3, 'elites derrubam item 10% mais', (m, l) => (m.eliteLootBonus += 0.1 * l)),
  n('lapidario', 'relicario', 2, 'Lapidário', 3, 'gemas caem 25% mais', (m, l) => (m.gemMul *= 1 + 0.25 * l)),
  n('encaixe', 'relicario', 2, 'Encaixe', 3, '+1 encaixe de gema no altar', () => {}),
  n('bigorna', 'relicario', 3, 'Bigorna', 3, 'forja 10% mais barata; nível 3: espaço até +6', () => {}),
  n('mercado_negro', 'relicario', 3, 'Mercado Negro', 3, '+1 item no mercado; renovar 20% mais barato', () => {}),
  n('tesouro_reis', 'relicario', 4, 'Tesouro dos Reis', 1, '+15% almas e gemas melhores', (m) => {
    m.soulMul += 0.15;
    m.gemMul *= 1.25;
  }),
];

export const NODE_BY_ID: Record<string, TreeNode> = Object.fromEntries(TREE.map((t) => [t.id, t]));
export const nodesOf = (b: BranchId) => TREE.filter((t) => t.branch === b);

// ------------------------------------------------------------ custos (ver docs/ARVORE.md)

export const GROWTH = 1.55;
export const TIER_BASE: Record<TreeNode['tier'], number> = { 1: 200, 2: 700, 3: 1900, 4: 9000 };
/** níveis extras do anel II (depois da coroa do ramo), só nos tiers 1 e 2 */
export const RING2_LEVELS = 3;
export const RING2_MUL = 3;

/** custos arredondados para múltiplos de 50 */
const roundCost = (v: number) => Math.max(50, Math.round(v / 50) * 50);

export const treeLevel = (meta: MetaState, id: string) => meta.tree[id] ?? 0;

/** Nível máximo do nó agora (anel II abre +3 nos tiers 1 e 2 depois da coroa). */
export function maxLevel(meta: MetaState, node: TreeNode): number {
  const crown = TREE.find((t) => t.branch === node.branch && t.tier === 4);
  const ring2 = node.tier <= 2 && node.max > 1 && crown && treeLevel(meta, crown.id) > 0;
  return node.max + (ring2 ? RING2_LEVELS : 0);
}

/** Custo para comprar o próximo nível (null = no máximo). */
export function nodeCost(meta: MetaState, node: TreeNode): number | null {
  const lvl = treeLevel(meta, node.id);
  if (lvl >= maxLevel(meta, node)) return null;
  const base = TIER_BASE[node.tier];
  if (lvl < node.max) return roundCost(base * GROWTH ** lvl);
  const last = base * GROWTH ** (node.max - 1);
  return roundCost(last * RING2_MUL * GROWTH ** (lvl - node.max));
}

/** Níveis comprados no ramo (conta para liberar as camadas). */
export const branchLevels = (meta: MetaState, b: BranchId) => nodesOf(b).reduce((a, t) => a + treeLevel(meta, t.id), 0);

export const TIER_RULES: Record<TreeNode['tier'], { branch: number; bosses: number; text: string }> = {
  1: { branch: 0, bosses: 0, text: '' },
  2: { branch: 6, bosses: 1, text: '6 níveis no ramo e o lenhador vencido' },
  3: { branch: 14, bosses: 2, text: '14 níveis no ramo e o abade vencido' },
  4: { branch: 0, bosses: 4, text: 'todos os nós da camada 3 e a catedral vencida' },
};

/** O nó está liberado para compra? Devolve o motivo se não estiver. */
export function lockReason(meta: MetaState, node: TreeNode): string | null {
  const rule = TIER_RULES[node.tier];
  if (node.tier === 4) {
    const t3 = nodesOf(node.branch).filter((t) => t.tier === 3);
    if (!t3.every((t) => treeLevel(meta, t.id) > 0) || meta.bossesBeaten < 4) return rule.text;
    return null;
  }
  if (branchLevels(meta, node.branch) < rule.branch || meta.bossesBeaten < rule.bosses) return rule.text;
  return null;
}

export function buyNode(meta: MetaState, id: string): boolean {
  const node = NODE_BY_ID[id];
  if (!node || lockReason(meta, node)) return false;
  const cost = nodeCost(meta, node);
  if (cost === null || meta.souls < cost) return false;
  meta.souls -= cost;
  meta.tree[id] = treeLevel(meta, id) + 1;
  return true;
}

/** Aplica todos os nós comprados. */
export function applyTree(m: Mods, meta: MetaState) {
  for (const node of TREE) {
    const l = treeLevel(meta, node.id);
    if (l > 0) node.apply(m, l);
  }
}

// ------------------------------------------------------------ efeitos fora da run

export const championUnlocked = (meta: MetaState) => treeLevel(meta, 'salao') > 0;
export const extraSockets = (meta: MetaState) => treeLevel(meta, 'encaixe');
export const forgeDiscount = (meta: MetaState) => 0.1 * treeLevel(meta, 'bigorna');
export const extraSlotLevel = (meta: MetaState) => (treeLevel(meta, 'bigorna') >= 3 ? 1 : 0);
export const extraMarket = (meta: MetaState) => treeLevel(meta, 'mercado_negro');
export const refreshDiscount = (meta: MetaState) => 0.2 * treeLevel(meta, 'mercado_negro');

/** Para o simulador e o debug: compra a árvore até um "nível de meta" (0..5). */
export function fillTree(meta: MetaState, level: number) {
  meta.tree = {};
  if (level <= 0) return;
  for (const node of TREE) {
    if (node.tier === 4) continue;
    const cap = node.tier === 1 ? level : node.tier === 2 ? level - 1 : level - 3;
    if (cap > 0) meta.tree[node.id] = Math.min(node.max, cap);
  }
}

export const treeBuilt = (meta: MetaState) => TREE.reduce((a, t) => a + Math.min(treeLevel(meta, t.id), t.max), 0);
export const treeTotal = () => TREE.reduce((a, t) => a + t.max, 0);
