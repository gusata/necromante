import { describe, expect, it } from 'vitest';
import { autopilot } from '../src/sim/autopilot';
import { computeMods, DOMINION_AT, MASTERY_AT } from '../src/sim/cards';
import { ARMY_CAP, NECRO, START_SKELETONS } from '../src/sim/defs';
import { freshMeta, metaMods, migrate, SAVE_VERSION, unlockedSchools } from '../src/sim/meta';
import { buyNode } from '../src/sim/tree';
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
    expect(a.boons).toEqual(b.boons);
  });

  it('começa com esqueletos e inicia a onda 1 na Vila', () => {
    const w = new World(setup());
    expect(w.units.filter((u) => u.kind === 'skeleton')).toHaveLength(START_SKELETONS);
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
    expect(w.units.filter((u) => u.faction === 'dead')).toHaveLength(START_SKELETONS + 1);
  });

  it('não levanta padres', () => {
    const w = new World(setup());
    const p = w.spawnLiving('priest');
    p.x = w.circle.x;
    p.y = w.circle.y;
    w.damage(p, 99);
    step(w, 1);
    expect(w.units.filter((u) => u.faction === 'dead')).toHaveLength(START_SKELETONS);
  });

  it('funde esqueletos em colossos (vários por toque na horda)', () => {
    const w = new World(setup());
    expect(w.fuse()).toBe(true);
    expect(w.units.filter((u) => u.kind === 'giant')).toHaveLength(START_SKELETONS / 3);
    expect(w.units.filter((u) => u.kind === 'skeleton')).toHaveLength(0);
    expect(w.armyUsed()).toBe((START_SKELETONS / 3) * 2);
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

  it('chefe aparece na onda 6', () => {
    const w = new World(setup());
    w.startWave(6);
    expect(w.isBossWave).toBe(true);
    expect(w.boss?.kind).toBe('woodcutter');
  });
});

describe('escolas pelos itens', () => {
  it('2 itens de uma escola liberam a maestria (e um morto novo), 4 o domínio', () => {
    expect(computeMods(baseMods(), [], { bone: MASTERY_AT - 1 }).boneRebirth).toBe(0);
    const mast = computeMods(baseMods(), [], { bone: MASTERY_AT });
    expect(mast.boneRebirth).toBeGreaterThan(0);
    expect(mast.raisePool.archer).toBeGreaterThan(0);
    expect(mast.raisePool.lich).toBeUndefined();
    const dom = computeMods(baseMods(), [], { bone: DOMINION_AT });
    expect(dom.boneDominion).toBe(true);
    expect(dom.fuseCount).toBe(2);
    expect(dom.raisePool.lich).toBeGreaterThan(0);
  });

  it('domínio do espírito atordoa os vivos', () => {
    const w = new World(setup({ schoolBonus: { spirit: DOMINION_AT } }));
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
    expect(m.version).toBe(SAVE_VERSION);
  });

  it('compra nós da árvore e aplica os bônus', () => {
    const m = freshMeta();
    m.souls = 1000;
    expect(buyNode(m, 'nichos')).toBe(true);
    expect(m.souls).toBe(800);
    expect(metaMods(m).armyCap).toBe(ARMY_CAP + 4);
    m.souls = 0;
    expect(buyNode(m, 'nichos')).toBe(false);
  });

  it('libera escolas conforme os chefes derrotados', () => {
    const m = freshMeta();
    expect(unlockedSchools(m)).toEqual(['bone', 'flesh']);
    m.bossesBeaten = 3;
    expect(unlockedSchools(m)).toHaveLength(5);
  });
});

describe('sem cartas', () => {
  it('a run não para para escolher nada no fim da onda', () => {
    const w = new World(setup());
    step(w, 120, true);
    expect(w.wave).toBeGreaterThan(2);
    expect((w as unknown as { offer?: unknown }).offer).toBeUndefined();
  });
});
