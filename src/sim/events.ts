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
  /** fração dos bandos que entra pelas laterais (0 = a da região) */
  flank: number;
  /** chance mínima de cada bando ser uma incursão (corre para o altar) */
  rush: number;
}

export const neutralFx = (): WaveFx => ({ hp: 1, size: 1, elites: 1, souls: 1, speed: 1, corpseLife: 1, eliteLoot: false, flank: 0, rush: 0 });

/** Ondas temáticas: às vezes uma onda comum vem com um jeito próprio. */
export interface WaveTheme {
  id: string;
  name: string;
  desc: string;
  /** primeira região onde aparece */
  from: number;
  fx: (f: WaveFx) => void;
}

export const WAVE_THEMES: WaveTheme[] = [
  {
    id: 'cavalgada',
    name: 'Cavalgada',
    desc: 'vivos 25% mais rápidos',
    from: 0,
    fx: (f) => {
      f.speed *= 1.25;
      f.size *= 0.9;
    },
  },
  {
    id: 'turba',
    name: 'Turba',
    desc: 'muitos vivos, mais fracos',
    from: 0,
    fx: (f) => {
      f.size *= 1.6;
      f.hp *= 0.6;
    },
  },
  {
    id: 'procissao',
    name: 'Procissão',
    desc: 'poucos vivos, bem mais duros',
    from: 1,
    fx: (f) => {
      f.size *= 0.7;
      f.hp *= 1.6;
      f.souls *= 1.2;
    },
  },
  { id: 'emboscada', name: 'Emboscada', desc: 'todos entram pelas laterais', from: 0, fx: (f) => (f.flank = 1) },
  {
    id: 'lua',
    name: 'Lua de Sangue',
    desc: 'elites 4x, sempre com item',
    from: 1,
    fx: (f) => {
      f.elites *= 4;
      f.eliteLoot = true;
    },
  },
  { id: 'invasao', name: 'Invasão', desc: 'quase todo bando corre para o altar', from: 0, fx: (f) => (f.rush = Math.max(f.rush, 0.75)) },
];

export const THEME_BY_ID: Record<string, WaveTheme> = Object.fromEntries(WAVE_THEMES.map((t) => [t.id, t]));

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
  {
    id: 'ossuary',
    title: 'Ossuário',
    text: 'Crânios empilhados até o teto. Ainda servem.',
    options: [
      ['PROFANAR', '+2 colossos agora. a próxima onda vem 20% maior'],
      ['SEGUIR', 'nada acontece'],
    ],
    resolve: (w, c) => {
      if (c !== 0) return;
      w.raiseFree('giant', 2);
      w.nextWave.size *= 1.2;
    },
  },
  {
    id: 'pilgrim',
    title: 'Peregrino Perdido',
    text: 'Um velho cego oferece uma bênção a quem o guiar.',
    options: [
      ['ENGANAR', 'uma dádiva agora, -30 de vida máxima'],
      ['IGNORAR', 'nada acontece'],
    ],
    can: (w) => w.necro.maxHp > 12,
    auto: (w) => (w.necro.maxHp >= 22 ? 0 : 1),
    resolve: (w, c) => {
      if (c !== 0) return;
      w.grantBoon('ev_wound');
      w.randomGift();
    },
  },
  {
    id: 'shrine',
    title: 'Santuário Sagrado',
    text: 'Velas acesas para um santo esquecido.',
    options: [
      ['PROFANAR', 'uma dádiva agora. a próxima onda traz o triplo de elites'],
      ['SEGUIR', 'nada acontece'],
    ],
    resolve: (w, c) => {
      if (c !== 0) return;
      w.randomGift();
      w.nextWave.elites *= 3;
    },
  },
  {
    id: 'cart',
    title: 'Carroça da Peste',
    text: 'Corpos amontoados, cobertos por moscas.',
    options: [
      ['ABRIR', '+10 ratos agora. na próxima onda os cadáveres duram metade'],
      ['QUEIMAR', 'nada acontece'],
    ],
    resolve: (w, c) => {
      if (c !== 0) return;
      w.raiseFree('rat', 10);
      w.nextWave.corpseLife *= 0.5;
    },
  },
  {
    id: 'gallows',
    title: 'Forca',
    text: 'Seis enforcados balançam ao vento.',
    options: [
      ['CORTAR A CORDA', '+6 carniçais agora. a próxima onda vem 25% mais rápida'],
      ['SEGUIR', 'nada acontece'],
    ],
    resolve: (w, c) => {
      if (c !== 0) return;
      w.raiseFree('ghoul', 6);
      w.nextWave.speed *= 1.25;
    },
  },
  {
    id: 'tithe',
    title: 'Dízimo',
    text: 'A caixa da igreja aceita qualquer moeda. Até almas.',
    options: [
      ['PAGAR', '30% das almas da run por +40 de vida máxima'],
      ['SEGUIR', 'nada acontece'],
    ],
    can: (w) => w.souls >= 200,
    auto: (w) => (w.necro.hp < w.necro.maxHp * 0.7 ? 0 : 1),
    resolve: (w, c) => {
      if (c !== 0) return;
      w.souls *= 0.7;
      w.grantBoon('ev_tithe');
    },
  },
  {
    id: 'mirror',
    title: 'Espelho Rachado',
    text: 'Seu reflexo sorri antes de você.',
    options: [
      ['OLHAR', '50%: uma dádiva. 50%: -40 de vida'],
      ['QUEBRAR', 'nada acontece'],
    ],
    can: (w) => w.necro.hp > 6,
    auto: (w) => (w.necro.hp > w.necro.maxHp * 0.7 ? 0 : 1),
    resolve: (w, c) => {
      if (c !== 0) return;
      const win = w.rng.next() < 0.5;
      if (win) w.randomGift();
      else w.necro.hp = Math.max(1, w.necro.hp - 4);
      w.events.push({ type: 'eventResult', good: win, text: win ? 'o reflexo te deu um presente' : 'o reflexo arranhou de volta' });
    },
  },
  {
    id: 'banner',
    title: 'Estandarte Caído',
    text: 'A bandeira de um exército que perdeu.',
    options: [
      ['ERGUER', 'mortos +10% dano até o fim. a próxima onda vem 30% maior'],
      ['DEIXAR', 'nada acontece'],
    ],
    resolve: (w, c) => {
      if (c !== 0) return;
      w.grantBoon('ev_banner');
      w.nextWave.size *= 1.3;
    },
  },
  {
    id: 'pyre',
    title: 'Pira Negra',
    text: 'O fogo verde cura quem o alimenta.',
    options: [
      ['ALIMENTAR', 'queima 10 mortos e cura toda a vida'],
      ['SEGUIR', 'nada acontece'],
    ],
    can: (w) => w.deadCount() >= 14 && w.necro.hp < w.necro.maxHp * 0.85,
    auto: (w) => (w.necro.hp < w.necro.maxHp * 0.6 ? 0 : 1),
    resolve: (w, c) => {
      if (c !== 0) return;
      w.sacrifice(10);
      w.healNecro(w.necro.maxHp);
    },
  },
  {
    id: 'storm',
    title: 'Céu Fendido',
    text: 'Os raios esperam uma ordem sua.',
    options: [
      ['INVOCAR', 'ritual carregado agora. a próxima onda vem 25% maior'],
      ['ESPERAR', 'nada acontece'],
    ],
    can: (w) => w.ritual < 0.8,
    resolve: (w, c) => {
      if (c !== 0) return;
      w.ritual = 1;
      w.nextWave.size *= 1.25;
    },
  },
  {
    id: 'crows',
    title: 'Corvos',
    text: 'Eles sempre sabem onde vai haver mortos.',
    options: [
      ['SEGUIR', 'a próxima onda vale +80% almas, mas vivos +30% vida'],
      ['ESPANTAR', 'nada acontece'],
    ],
    auto: () => 1,
    resolve: (w, c) => {
      if (c !== 0) return;
      w.nextWave.souls *= 1.8;
      w.nextWave.hp *= 1.3;
    },
  },
  {
    id: 'oath',
    title: 'Juramento Sombrio',
    text: 'Prometa mais mortes e receba adiantado.',
    options: [
      ['JURAR', 'uma dádiva agora. a próxima custa o dobro de abates'],
      ['RECUSAR', 'nada acontece'],
    ],
    resolve: (w, c) => {
      if (c !== 0) return;
      w.randomGift();
      w.nextGiftAt += Math.max(0, w.nextGiftAt - w.kills);
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
    flank: Math.max(a.flank, b.flank),
    rush: Math.max(a.rush, b.rush),
  };
}
