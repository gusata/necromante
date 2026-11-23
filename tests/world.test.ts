import { describe, expect, it } from 'vitest';
import { autopilot } from '../src/sim/autopilot';
import { CARDS, computeMods, rollOffer } from '../src/sim/cards';
import { NECRO } from '../src/sim/defs';
import { buy, freshMeta, metaMods, migrate, unlockedSchools } from '../src/sim/meta';
import { baseMods } from '../src/sim/mods';
import { World, type RunSetup } from '../src/sim/world';

const setup = (over: Partial<RunSetup> = {}): RunSetup => ({ seed: 1, mods: baseMods(), schools: ['bone', 'flesh', 'plague', 'spirit', 'blood'], ...over });
const step = (w: World, seconds: number, auto = false) => {
  for (let i = 0; i < seconds * 60; i++) {
    if (auto) autopilot(w);
    w.update(1 / 60);
  }
};

describe('World', () => {
  it('é determinístico com a mesma seed', () => {
    const a = new World(setup({ seed: 42 }));
    const b = new World(setup({ seed: 42 }));
    step(a, 40, true);
    step(b, 40, true);
    expect(a.units.map((u) => [u.kind, u.x, u.y, u.hp])).toEqual(b.units.map((u) => [u.kind, u.x, u.y, u.hp]));
    expect(a.necro.hp).toBe(b.necro.hp);
    expect(a.cards).toEqual(b.cards);
  });

  it('começa com esqueletos e inicia a onda 1 na Vila', () => {
    const w = new World(setup());
    expect(w.units.filter((u) => u.kind === 'skeleton')).toHaveLength(2);
    step(w, 2);
    expect(w.wave).toBe(1);
    expect(w.region.name).toBe('A Vila');
    expect(w.events.some((e) => e.type === 'regionStart')).toBe(true);
  });

  it('levanta cadáveres dentro do círculo', () => {
    const w = new World(setup());
    const p = w.spawnLiving('peasant');
    p.x = w.circle.x;
    p.y = w.circle.y;
    w.damage(p, 99);
    expect(w.corpses).toHaveLength(1);
    step(w, 1);
    expect(w.units.filter((u) => u.faction === 'dead')).toHaveLength(3);
  });

  it('não levanta padres', () => {
    const w = new World(setup());
    const p = w.spawnLiving('priest');
    p.x = w.circle.x;
    p.y = w.circle.y;
    w.damage(p, 99);
    step(w, 1);
    expect(w.units.filter((u) => u.faction === 'dead')).toHaveLength(2);
  });

  it('funde esqueletos num colosso', () => {
    const w = new World(setup());
    w.spawnDead('skeleton', w.circle.x, w.circle.y);
    expect(w.fuse()).toBe(true);
    expect(w.units.filter((u) => u.kind === 'giant')).toHaveLength(1);
    expect(w.armyUsed()).toBe(2);
  });

  it('explodir fere vivos e gasta os mortos', () => {
    const w = new World(setup());
    const p = w.spawnLiving('soldier');
    p.x = w.circle.x + 4;
    p.y = w.circle.y;
    const hp = p.hp;
    expect(w.explode()).toBe(true);
    expect(w.units.filter((u) => u.faction === 'dead')).toHaveLength(0);
    expect(p.hp).toBeLessThan(hp);
  });

  it('consumir cura o necromante', () => {
    const w = new World(setup());
    w.necro.hp = 10;
    expect(w.consume()).toBe(true);
    expect(w.necro.hp).toBeGreaterThan(10);
    expect(w.necro.hp).toBeLessThanOrEqual(NECRO.hp);
  });

  it('termina quando o necromante morre', () => {
    const w = new World(setup());
    w.necro.hp = 0;
    w.update(1 / 60);
    expect(w.phase).toBe('over');
  });

  it('o círculo não passa do alcance do necromante', () => {
    const w = new World(setup());
    w.setCircle(90, 0);
    expect(Math.hypot(w.circle.x - w.necro.x, w.circle.y - w.necro.y)).toBeLessThanOrEqual(180.01);
  });

  it('oferece cartas ao fim da onda e aplica a escolhida', () => {
    const w = new World(setup());
    step(w, 120, true);
    expect(w.cards.length).toBeGreaterThan(0);
  });

  it('chefe aparece na onda 6', () => {
    const w = new World(setup());
    w.startWave(6);
    expect(w.isBossWave).toBe(true);
    expect(w.boss?.kind).toBe('woodcutter');
  });
});

describe('cartas e sinergias', () => {
  it('3 cartas de uma escola liberam a maestria, 5 o domínio', () => {
    const bone = CARDS.filter((c) => c.school === 'bone').map((c) => c.id);
    expect(computeMods(baseMods(), bone.slice(0, 2)).boneRebirth).toBe(0);
    expect(computeMods(baseMods(), bone.slice(0, 3)).boneRebirth).toBeGreaterThan(0);
    const dom = computeMods(baseMods(), bone.slice(0, 5));
    expect(dom.boneDominion).toBe(true);
    expect(dom.fuseCount).toBe(2);
  });

  it('não oferece cartas de escolas bloqueadas nem acima do máximo', () => {
    let i = 0;
    const rand = () => ((i = (i * 9301 + 49297) % 233280) / 233280);
    for (let k = 0; k < 50; k++) {
      const offer = rollOffer(rand, ['bone_archers'], ['bone'], 4);
      expect(offer).not.toContain('bone_archers');
      for (const id of offer) expect(['bone', null]).toContain(CARDS.find((c) => c.id === id)!.school);
    }
  });

  it('domínio do espírito atordoa os vivos', () => {
    const spirit = CARDS.filter((c) => c.school === 'spirit').map((c) => c.id).slice(0, 5);
    const w = new World(setup());
    w.cards = spirit;
    (w as unknown as { recomputeMods: () => void }).recomputeMods();
    w.startWave(1);
    step(w, 3);
    w.screamT = 0;
    w.update(1 / 60);
    expect(w.events.some((e) => e.type === 'scream')).toBe(true);
  });
});

describe('meta', () => {
  it('migra o save v1 (só recorde)', () => {
    const m = migrate({ wave: 7, souls: 30 });
    expect(m.best.wave).toBe(7);
    expect(m.version).toBe(3);
  });

  it('compra construções e aplica os bônus', () => {
    const m = freshMeta();
    m.souls = 100;
    expect(buy(m, 'crypts')).toBe(true);
    expect(m.souls).toBe(75);
    expect(metaMods(m).armyCap).toBe(11);
    m.souls = 0;
    expect(buy(m, 'crypts')).toBe(false);
  });

  it('libera escolas conforme os chefes derrotados', () => {
    const m = freshMeta();
    expect(unlockedSchools(m)).toEqual(['bone', 'flesh']);
    m.bossesBeaten = 3;
    expect(unlockedSchools(m)).toHaveLength(5);
  });
});

describe('pré-requisitos das cartas', () => {
  it('não oferece buff de zumbi sem ter zumbis', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 200; k++) {
      const offer = rollOffer(rand, [], ['bone', 'flesh', 'plague', 'spirit', 'blood'], 4);
      expect(offer).not.toContain('flesh_rot');
      expect(offer).not.toContain('flesh_bite');
      expect(offer).not.toContain('spirit_wail');
    }
  });
});
