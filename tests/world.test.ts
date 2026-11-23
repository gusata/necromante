import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { NECRO } from '../src/sim/defs';

const run = (w: World, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) w.update(1 / 60);
};

describe('World', () => {
  it('é determinístico com a mesma seed', () => {
    const a = new World(42);
    const b = new World(42);
    run(a, 30);
    run(b, 30);
    expect(a.units.map((u) => [u.kind, u.x, u.y, u.hp])).toEqual(b.units.map((u) => [u.kind, u.x, u.y, u.hp]));
    expect(a.necro.hp).toBe(b.necro.hp);
  });

  it('começa com 2 esqueletos e inicia a onda 1', () => {
    const w = new World(1);
    expect(w.units.filter((u) => u.kind === 'skeleton')).toHaveLength(2);
    run(w, 2);
    expect(w.wave).toBe(1);
  });

  it('levanta cadáveres dentro do círculo', () => {
    const w = new World(1);
    const p = w.spawnUnit('peasant', w.circle.x, w.circle.y);
    w.damage(p, 99);
    expect(w.corpses).toHaveLength(1);
    run(w, 1);
    expect(w.corpses).toHaveLength(0);
    expect(w.units.filter((u) => u.kind === 'skeleton')).toHaveLength(3);
  });

  it('não levanta padres', () => {
    const w = new World(1);
    const p = w.spawnUnit('priest', w.circle.x, w.circle.y);
    w.damage(p, 99);
    run(w, 1);
    expect(w.units.filter((u) => u.kind === 'skeleton')).toHaveLength(2);
  });

  it('funde 3 esqueletos num colosso', () => {
    const w = new World(1);
    w.spawnUnit('skeleton', w.circle.x, w.circle.y);
    expect(w.canFuse()).toBe(true);
    expect(w.fuse()).toBe(true);
    expect(w.units.filter((u) => u.kind === 'giant')).toHaveLength(1);
    expect(w.units.filter((u) => u.kind === 'skeleton')).toHaveLength(0);
    expect(w.armyUsed()).toBe(2);
  });

  it('explodir fere vivos e gasta os mortos', () => {
    const w = new World(1);
    const p = w.spawnUnit('soldier', w.circle.x + 4, w.circle.y);
    const hp = p.hp;
    expect(w.explode()).toBe(true);
    expect(w.units.filter((u) => u.faction === 'dead')).toHaveLength(0);
    expect(p.hp).toBeLessThan(hp);
  });

  it('consumir cura o necromante', () => {
    const w = new World(1);
    w.necro.hp = 10;
    expect(w.consume()).toBe(true);
    expect(w.necro.hp).toBeGreaterThan(10);
    expect(w.necro.hp).toBeLessThanOrEqual(NECRO.hp);
  });

  it('termina quando o necromante morre', () => {
    const w = new World(1);
    w.necro.hp = 0;
    w.update(1 / 60);
    expect(w.phase).toBe('over');
    expect(w.events.some((e) => e.type === 'gameOver')).toBe(true);
  });
});

describe('círculo', () => {
  it('não passa do alcance do necromante', () => {
    const w = new World(1);
    w.setCircle(90, 0);
    expect(Math.hypot(w.circle.x - w.necro.x, w.circle.y - w.necro.y)).toBeLessThanOrEqual(180.01);
    expect(w.circle.y).toBeGreaterThan(80);
  });
});
