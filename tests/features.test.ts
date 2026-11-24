import { describe, expect, it } from 'vitest';
import { autopilot } from '../src/sim/autopilot';
import { ITEMS, relicsOf, rollItem, rollRelic } from '../src/sim/items';
import { EVENTS, ROUTES } from '../src/sim/events';
import { heresyEffects } from '../src/sim/heresy';
import { freshMeta, migrate } from '../src/sim/meta';
import { baseMods } from '../src/sim/mods';
import { ACHIEVEMENTS, applyRunResult, dailySetup, type RunResult } from '../src/sim/progress';
import { SpatialGrid } from '../src/sim/spatial';
import { RITUAL_KILLS, World, type RunSetup } from '../src/sim/world';

const setup = (over: Partial<RunSetup> = {}): RunSetup => ({ seed: 7, mods: baseMods(), schools: ['bone', 'flesh', 'plague', 'spirit', 'blood'], ...over });
const step = (w: World, seconds: number, auto = true) => {
  for (let i = 0; i < seconds * 60 && w.phase !== 'over'; i++) {
    if (auto) autopilot(w);
    w.update(1 / 60);
  }
};
const state = (w: World) => [
  w.wave,
  w.phase,
  w.necro.hp,
  w.souls,
  w.kills,
  w.boons.join(),
  w.units.map((u) => [u.kind, Math.round(u.x * 100), Math.round(u.y * 100), u.hp]),
];

describe('grade espacial', () => {
  it('acha o mais perto igual à busca linear', () => {
    const g = new SpatialGrid(180, 296);
    const pts = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, x: (i * 37) % 180, y: (i * 53) % 296, alive: true, radius: 4 }));
    for (const p of pts) g.insert(p as never);
    for (const [x, y] of [
      [10, 10],
      [90, 150],
      [170, 290],
    ]) {
      const near = g.nearest(x, y, 60, null);
      let best: (typeof pts)[0] | undefined;
      let bd = 60 * 60;
      for (const p of pts) {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bd || (d === bd && best && p.id < best.id)) {
          bd = d;
          best = p;
        }
      }
      expect(near?.id).toBe(best?.id);
    }
  });
});

describe('salvar e retomar', () => {
  it('a run retomada segue idêntica à original', () => {
    const a = new World(setup({ seed: 99 }));
    step(a, 50);
    const snap = JSON.parse(JSON.stringify(a.snapshot()));
    const b = World.restore(snap);
    step(a, 40);
    step(b, 40);
    expect(state(b)).toEqual(state(a));
  });

  it('salva no meio da onda com projéteis e cadáveres', () => {
    const a = new World(setup({ seed: 3 }));
    a.wave = 13;
    step(a, 30);
    const b = World.restore(a.snapshot());
    expect(b.units.length).toBe(a.units.length);
    expect(b.corpses.length).toBe(a.corpses.length);
    expect(b.mods.armyCap).toBe(a.mods.armyCap);
  });
});

describe('eventos e encruzilhadas', () => {
  it('todo evento resolve e devolve a run para o jogo', () => {
    for (const ev of EVENTS) {
      for (const choice of [0, 1]) {
        const w = new World(setup());
        step(w, 3, false);
        for (let i = 0; i < 6; i++) w.spawnDead('skeleton', 90, 200);
        w.souls = 100;
        w.necro.hp = 5;
        w.phase = 'event';
        w.event = { id: ev.id, choices: [] };
        expect(w.resolveEvent(choice)).toBe(true);
        expect(['intermission', 'choosing']).toContain(w.phase);
      }
    }
  });

  it('a encruzilhada aparece depois do chefe e aplica a rota na região seguinte', () => {
    const w = new World(setup());
    w.wave = 6;
    w.phase = 'fighting';
    (w as unknown as { afterChoice: () => void }).afterChoice();
    expect(w.phase).toBe('event');
    expect(w.event?.id).toBe('route');
    expect(w.event?.choices).toHaveLength(2);
    const hanged = ROUTES.find((r) => r.id === 'hanged')!;
    w.event = { id: 'route', choices: [hanged.id, 'royal'] };
    w.resolveEvent(0);
    w.startWave(7);
    expect(w.waveFx.size).toBeCloseTo(1.3);
    expect(w.waveFx.souls).toBeCloseTo(1.5);
  });

  it('relíquias: duas por cerco, nunca saem no sorteio comum', () => {
    for (let r = 0; r < 4; r++) expect(relicsOf(r)).toHaveLength(2);
    let seed = 3;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const rarityOf = (id: string) => ITEMS.find((i) => i.id === id)!.rarity;
    for (let k = 0; k < 3000; k++) expect(rarityOf(rollItem(rand, 1))).not.toBe('legendary');
    for (let k = 0; k < 50; k++) expect(relicsOf(1).map((i) => i.id)).toContain(rollRelic(rand, 1));
  });

  it('raros são difíceis: menos de 1 em 12 sem sorte', () => {
    let seed = 5;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let rare = 0;
    for (let k = 0; k < 4000; k++) {
      const id = rollItem(rand, 0);
      if (['rare', 'set'].includes(ITEMS.find((i) => i.id === id)!.rarity)) rare++;
    }
    expect(rare / 4000).toBeLessThan(1 / 12);
  });

  it('o piloto automático joga eventos sem travar', () => {
    const w = new World(setup({ seed: 11 }));
    step(w, 400);
    expect(w.wave).toBeGreaterThan(3);
  }, 30000);
});

describe('heresia', () => {
  it('soma os efeitos dos níveis', () => {
    expect(heresyEffects(0).livingHp).toBe(1);
    expect(heresyEffects(4).waveSize).toBe(1.2);
    expect(heresyEffects(10).livingDmg).toBe(1);
    const w = new World(setup({ heresy: 10 }));
    expect(w.units.filter((u) => u.kind === 'skeleton')).toHaveLength(0);
    expect(w.mods.soulMul).toBeCloseTo(2);
  });
});

describe('ritual', () => {
  it('carrega com abates e cada personagem lança o seu', () => {
    for (const character of ['necro', 'witch', 'digger', 'reaper', 'vampire']) {
      const w = new World(setup({ character }));
      step(w, 2, false);
      expect(w.canRitual()).toBe(false);
      for (let i = 0; i < RITUAL_KILLS; i++) w.damage(w.spawnLiving('peasant'), 999);
      for (let i = 0; i < 5; i++) {
        const p = w.spawnLiving('soldier');
        p.x = w.circle.x;
        p.y = w.circle.y;
      }
      expect(w.ritual).toBe(1);
      expect(w.castRitual()).toBe(true);
      expect(w.ritual).toBeLessThan(0.5);
      expect(w.events.some((e) => e.type === 'ritual')).toBe(true);
    }
  });
});

describe('progresso', () => {
  const result = (over: Partial<RunResult> = {}): RunResult => ({
    wave: 7,
    where: 'o mosteiro - onda 1',
    souls: 50,
    kills: 120,
    killsByKind: { peasant: 100 },
    bossesKilled: ['woodcutter'],
    loot: [],
    cards: 4,
    schoolCounts: { bone: 3, flesh: 1, plague: 0, spirit: 0, blood: 0 },
    character: 'necro',
    heresy: 0,
    daily: null,
    quit: false,
    time: 300,
    stats: { raised: 30, exploded: 10, consumed: 2, fused: 1, maxArmy: 12, bigExplode: 5, rituals: 2, deadKills: { skeleton: 40, archer: 3 } },
    ...over,
  });

  it('registra histórico, estatísticas e conquistas uma vez só', () => {
    const m = freshMeta();
    const s = applyRunResult(m, result());
    expect(m.history).toHaveLength(1);
    expect(m.history[0].mvp).toBe('Esqueleto');
    expect(m.stats.kills).toBe(120);
    const ids = s.achievements.map((a) => a.id);
    expect(ids).toContain('first');
    expect(ids).toContain('woodcutter');
    expect(m.souls).toBe(50 + s.bonus);
    const again = applyRunResult(m, result());
    expect(again.achievements.map((a) => a.id)).not.toContain('first');
  });

  it('vencer a catedral libera a próxima heresia', () => {
    const m = freshMeta();
    const s = applyRunResult(m, result({ bossesKilled: ['woodcutter', 'abbot', 'commander', 'archbishop'], wave: 25 }));
    expect(s.heresyUnlocked).toBe(1);
    expect(m.heresyMax).toBe(1);
    applyRunResult(m, result({ bossesKilled: ['archbishop'], heresy: 1 }));
    expect(m.heresyMax).toBe(2);
  });

  it('diário: seed fixa por dia, bônus só na primeira tentativa', () => {
    expect(dailySetup('2026-11-24')).toEqual(dailySetup('2026-11-24'));
    expect(dailySetup('2026-11-24').seed).not.toBe(dailySetup('2026-11-25').seed);
    expect(dailySetup('2026-11-24').endless).toHaveLength(2);
    const m = freshMeta();
    const a = applyRunResult(m, result({ daily: '2026-11-24', bossesKilled: [], wave: 5 }));
    const b = applyRunResult(m, result({ daily: '2026-11-24', bossesKilled: [], wave: 4 }));
    expect(a.bonus).toBeGreaterThanOrEqual(15);
    expect(b.bonus).toBe(0);
    expect(m.daily.best).toBe(5);
    expect(m.best.wave).toBe(0);
  });

  it('migra saves antigos com os campos novos', () => {
    const old = { version: 3, runs: 4, souls: 10, best: { wave: 9, souls: 3 } };
    const m = migrate(old);
    expect(m.history).toEqual([]);
    expect(m.stats.kills).toBe(0);
    expect(m.tutorial.length).toBeGreaterThan(0);
    expect(m.heresyMax).toBe(0);
    expect(ACHIEVEMENTS.length).toBeGreaterThan(15);
  });
});

describe('horda', () => {
  it('os vivos chegam em bandos', () => {
    const w = new World(setup());
    w.startWave(3);
    w.spawnTimer = 0;
    w.update(1 / 60);
    expect(w.units.filter((u) => u.faction === 'living').length).toBeGreaterThanOrEqual(6);
    expect(w.waveSize).toBeGreaterThan(40);
  });

  it('o fim da onda não para para escolher nada', () => {
    for (const wave of [1, 2, 6]) {
      const w = new World(setup());
      w.wave = wave;
      w.phase = 'fighting';
      (w as unknown as { checkWaveEnd: () => void }).checkWaveEnd();
      expect(['intermission', 'event']).toContain(w.phase);
    }
  });

  it('no fim da onda os mortos caçam os últimos vivos (a onda não trava)', () => {
    const w = new World(setup());
    w.startWave(1);
    w.spawnQueue = [];
    w.phase = 'fighting';
    w.waveSize = 40;
    const far = w.spawnLiving('crossbow');
    far.x = 10;
    far.y = 20;
    far.speed = 0;
    step(w, 25, false);
    expect(far.alive).toBe(false);
  });
});

describe('tesouro, conjuntos e gemas', () => {
  it('lendário dá bônus de tesouro mesmo guardado', async () => {
    const { metaMods, freshMeta: fm } = await import('../src/sim/meta');
    const m = fm();
    const base = metaMods(m).armyCap;
    m.items.hood_lich = 0; // guardado, não equipado
    expect(metaMods(m).armyCap).toBe(base + 2);
  });

  it('conjunto: 2 e 3 peças ligam os bônus e cada peça conta para duas escolas', async () => {
    const { metaMods, schoolBonus, gainItem, freshMeta: fm } = await import('../src/sim/meta');
    const m = fm();
    gainItem(m, 'staff_pest');
    expect(metaMods(m).boneVenom).toBe(false);
    gainItem(m, 'hood_pest');
    expect(metaMods(m).boneVenom).toBe(true);
    expect(metaMods(m).boneDeathCloud).toBe(false);
    gainItem(m, 'ring_pest');
    expect(metaMods(m).boneDeathCloud).toBe(true);
    expect(schoolBonus(m)).toMatchObject({ bone: 3, plague: 3 });
  });

  it('gemas: 3 iguais viram uma de nível acima e o encaixe aplica o efeito', async () => {
    const { metaMods, socketGem, unsocketGem, mergeAllGems, freshMeta: fm } = await import('../src/sim/meta');
    const m = fm();
    m.gems = { ruby1: 7 };
    expect(mergeAllGems(m)).toBe(2);
    expect(m.gems).toEqual({ ruby1: 1, ruby2: 2 });
    const before = metaMods(m).deadDmgMul;
    expect(socketGem(m, 'ruby2')).toBe(true);
    expect(m.gems.ruby2).toBe(1);
    expect(metaMods(m).deadDmgMul).toBeCloseTo(before * 1.05);
    expect(unsocketGem(m, 0)).toBe(true);
    expect(m.gems.ruby2).toBe(2);
  });

  it('chefe derruba gemas', () => {
    const w = new World(setup());
    w.wave = 5;
    w.startWave(6);
    const boss = w.boss!;
    w.damage(boss, 99999);
    expect(w.gems.length).toBeGreaterThanOrEqual(2);
  });
});

describe('arremessador e laterais', () => {
  it('o arremessador joga um vivo perto do altar', () => {
    const w = new World(setup());
    w.startWave(13);
    w.spawnQueue = [];
    for (const u of w.units) if (u.faction === 'living') u.alive = false;
    const h = w.spawnLiving('hurler', false);
    h.x = 90;
    h.y = 150;
    h.traitTimer = 0;
    w.update(1 / 60);
    expect(w.telegraphs.some((t) => t.ability === 'throw')).toBe(true);
    const before = w.units.filter((u) => u.alive && u.faction === 'living').length;
    for (let i = 0; i < 70; i++) w.update(1 / 60);
    const near = w.units.filter((u) => u.alive && u.faction === 'living' && u !== h && Math.hypot(u.x - 90, u.y - 274) < 90);
    expect(near.length).toBeGreaterThanOrEqual(1);
    expect(w.units.filter((u) => u.alive && u.faction === 'living').length).toBeGreaterThan(before - 1);
  });

  it('a partir do Mosteiro alguns bandos entram pelas laterais', () => {
    let flanks = 0;
    for (let seed = 1; seed < 8; seed++) {
      const w = new World(setup({ seed }));
      w.startWave(9);
      for (let i = 0; i < 60 * 20; i++) {
        w.update(1 / 60);
        flanks += w.events.filter((e) => e.type === 'flank').length;
        w.events.length = 0;
      }
    }
    expect(flanks).toBeGreaterThan(0);
  });
});

describe('checkpoint', () => {
  it('começar na Fortaleza: esqueletos extras, encruzilhada e onda 13', async () => {
    const { CHECKPOINT_SKELETONS } = await import('../src/sim/world');
    const w = new World(setup({ startRegion: 2 }));
    expect(w.wave).toBe(12);
    expect(w.units.filter((u) => u.kind === 'skeleton').length).toBeGreaterThanOrEqual(2 * CHECKPOINT_SKELETONS);
    expect(w.phase).toBe('event');
    expect(w.event?.id).toBe('route');
    w.resolveEvent(0);
    step(w, 3, false);
    expect(w.wave).toBe(13);
    expect(w.region.name).toBe('A Fortaleza');
  });

  it('só libera regiões de chefes vencidos', async () => {
    const { freshMeta: fm, maxStartRegion } = await import('../src/sim/meta');
    const m = fm();
    expect(maxStartRegion(m)).toBe(0);
    m.bossesBeaten = 2;
    expect(maxStartRegion(m)).toBe(2);
    m.bossesBeaten = 4;
    expect(maxStartRegion(m)).toBe(3);
  });
});

describe('árvore da necrópole', () => {
  it('camadas travadas por níveis no ramo e por chefes', async () => {
    const { freshMeta: fm } = await import('../src/sim/meta');
    const { buyNode, lockReason, NODE_BY_ID, nodeCost } = await import('../src/sim/tree');
    const m = fm();
    m.souls = 1e6;
    expect(lockReason(m, NODE_BY_ID.rito_ligeiro)).not.toBeNull();
    for (let i = 0; i < 6; i++) expect(buyNode(m, 'nichos') || buyNode(m, 'covas_rasas')).toBe(true);
    expect(lockReason(m, NODE_BY_ID.rito_ligeiro)).not.toBeNull(); // falta o chefe
    m.bossesBeaten = 1;
    expect(lockReason(m, NODE_BY_ID.rito_ligeiro)).toBeNull();
    expect(buyNode(m, 'rito_ligeiro')).toBe(true);
    // custos crescem por nível
    expect(nodeCost(m, NODE_BY_ID.rito_ligeiro)!).toBeGreaterThan(700);
    expect(lockReason(m, NODE_BY_ID.necropole_viva)).not.toBeNull();
  });

  it('coroa abre o anel II (+3 níveis) e o Imortal salva uma vez', async () => {
    const { freshMeta: fm, metaMods } = await import('../src/sim/meta');
    const { maxLevel, NODE_BY_ID } = await import('../src/sim/tree');
    const m = fm();
    expect(maxLevel(m, NODE_BY_ID.nichos)).toBe(5);
    m.tree.necropole_viva = 1;
    expect(maxLevel(m, NODE_BY_ID.nichos)).toBe(8);
    m.tree.imortal = 1;
    const w = new World(setup({ mods: metaMods(m) }));
    step(w, 3, false);
    w.necro.hp = -5;
    w.update(1 / 60);
    expect(w.phase).not.toBe('over');
    expect(w.necro.hp).toBeGreaterThan(0);
    w.necro.hp = -5;
    w.update(1 / 60);
    expect(w.phase).toBe('over');
  });

  it('migração v5: devolve as almas das construções e multiplica por 10', async () => {
    const { migrate: mg } = await import('../src/sim/meta');
    const m = mg({ version: 4, souls: 100, totalSouls: 200, buildings: { crypts: 2, hall: 1 }, best: { wave: 9, souls: 30 } });
    // 100 x10 = 1000, mais as criptas (250 + 600) e o salão (800)
    expect(m.souls).toBe(1000 + 250 + 600 + 800);
    expect(m.tree.salao).toBe(1);
    expect(m.buildings).toEqual({});
    expect(m.best.souls).toBe(300);
  });
});
