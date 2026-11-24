import type { World } from './world';

/**
 * Eventos entre ondas e encruzilhadas entre regiões.
 * Cada evento é uma escolha com risco: ganhar algo agora pagando depois (ou arriscar).
 */
export interface EventDef {
  id: string;
  title: string;
  text: string;
  /** [rótulo do botão, texto curto do efeito] */
  options: [string, string][];
  /** pode aparecer agora? */
  can?: (w: World) => boolean;
  resolve: (w: World, choice: number) => void;
  /** escolha do piloto automático */
  auto?: (w: World) => number;
}

/** Efeitos que valem só para a próxima onda (ou para a região inteira, nas rotas). */
export interface WaveFx {
  hp: number;
  size: number;
  elites: number;
  souls: number;
  speed: number;
  corpseLife: number;
  /** elites sempre derrubam item */
  eliteLoot: boolean;
}

export const neutralFx = (): WaveFx => ({ hp: 1, size: 1, elites: 1, souls: 1, speed: 1, corpseLife: 1, eliteLoot: false });

export const EVENTS: EventDef[] = [
  {
    id: 'altar',
    title: 'Altar Profano',
    text: 'Um altar manchado pede carne morta.',
    options: [
      ['SACRIFICAR', 'metade do exército por um item raro'],
      ['RECUSAR', 'nada acontece'],
    ],
    can: (w) => w.deadCount() >= 4,
    resolve: (w, c) => {
      if (c !== 0) return;
      w.sacrificeHalf();
      w.grantRareItem();
    },
  },
  {
    id: 'grave',
    title: 'Cova Rasa',
    text: 'Mãos saem da terra pedindo um mestre.',
    options: [
      ['LEVANTAR', '+12 esqueletos agora. a próxima onda vem +25% mais resistente'],
      ['DEIXAR', 'nada acontece'],
    ],
    resolve: (w, c) => {
      if (c !== 0) return;
      w.raiseFree('skeleton', 12);
      w.nextWave.hp *= 1.25;
    },
  },
  {
    id: 'blood',
    title: 'Pacto de Sangue',
    text: 'Uma voz oferece poder em troca de sangue.',
    options: [
      ['ACEITAR', '-50 de vida máxima por um item raro'],
      ['RECUSAR', 'nada acontece'],
    ],
    can: (w) => w.necro.maxHp > 12,
    auto: (w) => (w.necro.maxHp >= 24 ? 0 : 1),
    resolve: (w, c) => {
      if (c !== 0) return;
      w.grantBoon('ev_scar');
      w.grantRareItem();
    },
  },
  {
    id: 'relic',
    title: 'Relicário Abandonado',
    text: 'Um item brilha entre os ossos. Algo o vigia.',
    options: [
      ['PEGAR', 'ganha um item. a próxima onda traz o triplo de elites'],
      ['DEIXAR', 'nada acontece'],
    ],
    resolve: (w, c) => {
      if (c !== 0) return;
      w.grantItem();
      w.nextWave.elites *= 3;
      w.nextWave.size *= 1.15;
    },
  },
  {
    id: 'fountain',
    title: 'Fonte Escura',
    text: 'A água é negra e quente.',
    options: [
      ['BEBER', 'cura toda a vida por 40% das almas da run'],
      ['SEGUIR', 'nada acontece'],
    ],
    can: (w) => w.necro.hp < w.necro.maxHp * 0.8 && w.souls >= 100,
    auto: (w) => (w.necro.hp < w.necro.maxHp * 0.5 ? 0 : 1),
    resolve: (w, c) => {
      if (c !== 0) return;
      w.souls *= 0.6;
      w.healNecro(w.necro.maxHp);
    },
  },
  {
    id: 'well',
    title: 'Poço das Almas',
    text: 'Dizem que o poço devolve em dobro. Às vezes.',
    options: [
      ['JOGAR', '50%: dobra as almas da run. 50%: perde metade'],
      ['SEGUIR', 'nada acontece'],
    ],
    can: (w) => w.souls >= 150,
    auto: () => 1,
    resolve: (w, c) => {
      if (c !== 0) return;
      const win = w.rng.next() < 0.5;
      w.souls *= win ? 2 : 0.5;
      w.events.push({ type: 'eventResult', good: win, text: win ? 'o poço devolveu em dobro!' : 'o poço engoliu metade' });
    },
  },
  {
    id: 'crypt',
    title: 'Cripta Selada',
    text: 'Espaço para mais mortos, mas o ar apodrece tudo.',
    options: [
      ['ABRIR', '+10 no limite do exército, cadáveres duram 2s a menos'],
      ['SELAR', 'nada acontece'],
    ],
    resolve: (w, c) => {
      if (c === 0) w.grantBoon('ev_crypt');
    },
  },
  {
    id: 'bell',
    title: 'Sino Rachado',
    text: 'Se tocar, todos os vivos vão ouvir.',
    options: [
      ['TOCAR', 'próxima onda 50% maior, mas cada abate vale o dobro de almas'],
      ['IGNORAR', 'nada acontece'],
    ],
    auto: () => 1,
    resolve: (w, c) => {
      if (c !== 0) return;
      w.nextWave.size *= 1.5;
      w.nextWave.souls *= 2;
    },
  },
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

// ------------------------------------------------------------ encruzilhada (entre regiões)

export interface RouteDef {
  id: string;
  name: string;
  desc: string;
  fx: (f: WaveFx) => void;
  /** efeito imediato ao escolher */
  now?: (w: World) => void;
}

export const ROUTES: RouteDef[] = [
  { id: 'royal', name: 'Estrada Real', desc: 'o caminho conhecido. nada muda', fx: () => {} },
  {
    id: 'hanged',
    name: 'Trilha dos Enforcados',
    desc: '+30% inimigos, +50% almas',
    fx: (f) => {
      f.size *= 1.3;
      f.souls *= 1.5;
    },
  },
  {
    id: 'swamp',
    name: 'Pântano Pútrido',
    desc: 'vivos 15% mais lentos, cadáveres duram metade',
    fx: (f) => {
      f.speed *= 0.85;
      f.corpseLife *= 0.5;
    },
  },
  {
    id: 'graves',
    name: 'Vale das Covas',
    desc: '+15 esqueletos agora, vivos +20% vida',
    fx: (f) => (f.hp *= 1.2),
    now: (w) => w.raiseFree('skeleton', 15),
  },
  {
    id: 'pilgrims',
    name: 'Rota dos Peregrinos',
    desc: 'elites sempre derrubam item, vivos +15% vida',
    fx: (f) => {
      f.eliteLoot = true;
      f.hp *= 1.15;
    },
  },
  {
    id: 'night',
    name: 'Noite Sem Lua',
    desc: 'elites 3x mais comuns, +60% almas',
    fx: (f) => {
      f.elites *= 3;
      f.souls *= 1.6;
    },
  },
];

export const ROUTE_BY_ID: Record<string, RouteDef> = Object.fromEntries(ROUTES.map((r) => [r.id, r]));

export function routeFx(id: string | null): WaveFx {
  const f = neutralFx();
  if (id) ROUTE_BY_ID[id]?.fx(f);
  return f;
}

export function combineFx(a: WaveFx, b: WaveFx): WaveFx {
  return {
    hp: a.hp * b.hp,
    size: a.size * b.size,
    elites: a.elites * b.elites,
    souls: a.souls * b.souls,
    speed: a.speed * b.speed,
    corpseLife: a.corpseLife * b.corpseLife,
    eliteLoot: a.eliteLoot || b.eliteLoot,
  };
}
