import type { MetaState } from './meta';
import type { Mods } from './mods';
import type { School } from './types';

export type CharacterId = 'necro' | 'witch' | 'reaper' | 'vampire' | 'digger';

export interface Character {
  id: CharacterId;
  name: string;
  title: string;
  /** como o personagem muda o jogo, em linhas curtas */
  traits: string[];
  /** habilidade especial carregada por abates */
  ritual: { name: string; desc: string };
  /** conta como itens extras de uma escola */
  school?: Partial<Record<School, number>>;
  /** escolas sempre liberadas para este personagem */
  schools?: School[];
  price: number;
  unlock: { text: string; check: (m: MetaState) => boolean };
  apply: (m: Mods) => void;
}

export const CHARACTERS: Character[] = [
  {
    id: 'necro',
    name: 'O Necromante',
    title: 'equilibrado',
    traits: ['raios rápidos em um alvo', 'nenhuma fraqueza, nenhum truque'],
    ritual: { name: 'Tempestade de Almas', desc: 'um raio em cada vivo do campo' },
    price: 0,
    unlock: { text: '', check: () => true },
    apply: () => {},
  },
  {
    id: 'witch',
    name: 'A Bruxa da Praga',
    title: 'veneno e paciência',
    traits: ['conta como 1 item de praga', 'o círculo envenena', 'explodir deixa nuvem tóxica', 'raios 30% mais lentos, -40 vida'],
    ritual: { name: 'Peste Negra', desc: 'envenena todos os vivos e espalha nuvens' },
    school: { plague: 1 },
    schools: ['plague'],
    price: 1200,
    unlock: { text: 'derrote o lenhador', check: (m) => m.bossesBeaten >= 1 },
    apply: (m) => {
      m.circleMiasma += 0.15;
      m.explodePoison = true;
      m.castCdMul *= 1.3;
      m.necroMaxHp -= 4;
    },
  },
  {
    id: 'digger',
    name: 'O Coveiro',
    title: 'quantidade acima de tudo',
    traits: ['cada cadáver levanta 2 mortos', 'limite do exército -15', 'cadáveres duram +4s'],
    ritual: { name: 'Cova Coletiva', desc: 'todo cadáver do campo levanta, sem limite' },
    price: 1500,
    unlock: { text: 'jogue 3 runs', check: (m) => m.runs >= 3 },
    apply: (m) => {
      m.doubleRaise = true;
      m.armyCap -= 15;
      m.corpseLife += 4;
    },
  },
  {
    id: 'reaper',
    name: 'O Ceifador',
    title: 'a foice não escolhe',
    traits: ['a foice acerta todos no círculo', 'golpes mais lentos e pesados', 'círculo maior', 'conta como 1 item de espírito'],
    ritual: { name: 'Grande Colheita', desc: 'corte enorme que executa os feridos' },
    school: { spirit: 1 },
    schools: ['spirit'],
    price: 2500,
    unlock: { text: 'derrote o abade', check: (m) => m.bossesBeaten >= 2 },
    apply: (m) => {
      m.scythe = true;
      m.circleR += 4;
      m.necroDmg += 0.5;
    },
  },
  {
    id: 'vampire',
    name: 'A Vampira',
    title: 'vive do que mata',
    traits: ['perde 10 de vida a cada 8s', 'cada 8 abates cura 10', 'mortos +15% dano e roubam vida', 'consumir cura o dobro', 'conta como 1 item de sangue'],
    ritual: { name: 'Banquete', desc: 'drena os vivos em volta, cura e dá frenesi' },
    school: { blood: 1 },
    schools: ['blood'],
    price: 3500,
    unlock: { text: 'derrote o comandante', check: (m) => m.bossesBeaten >= 3 },
    apply: (m) => {
      m.necroDrain += 0.12;
      m.killHeal += 1 / 8;
      m.deadDmgMul *= 1.15;
      m.lifesteal += 0.2;
      m.consumeHealMul *= 2;
      m.necroMaxHp += 6;
    },
  },
];

export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c])) as Record<CharacterId, Character>;
