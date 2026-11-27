import { describe, expect, it } from 'vitest';
import { APOTHEOSIS_AT, computeMods, SCHOOL_ORDER, SCHOOLS, schoolTier } from '../src/sim/cards';
import { baseMods } from '../src/sim/mods';
import { type RunSetup, World } from '../src/sim/world';

const setup = (over: Partial<RunSetup> = {}): RunSetup => ({ seed: 1, mods: baseMods(), schools: ['bone', 'flesh', 'plague', 'spirit', 'blood'], ...over });
const step = (w: World, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) w.update(1 / 60);
};

describe('degraus das escolas', () => {
  it('degraus: 1 básico (não conta), 2 maestria, 4 domínio, 6 apoteose', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(schoolTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    for (const sc of SCHOOL_ORDER) {
      const info = SCHOOLS[sc];
      expect(info.base.length).toBeGreaterThan(10);
      expect(info.apotheosis.length).toBeGreaterThan(10);
      expect(info.apotheosisName).not.toBe(info.dominionName);
    }
  });

  it('1 item já liga o básico de cada escola', () => {
    const none = computeMods(baseMods(), [], {});
    expect(computeMods(baseMods(), [], { bone: 1 }).boneKnock).toBeGreaterThan(0);
    expect(computeMods(baseMods(), [], { flesh: 1 }).fleshMend).toBeGreaterThan(0);
    expect(computeMods(baseMods(), [], { plague: 1 }).plagueTouch).toBeGreaterThan(0);
    expect(computeMods(baseMods(), [], { spirit: 1 }).spiritChill).toBeGreaterThan(0);
    expect(computeMods(baseMods(), [], { blood: 1 }).killHeal).toBeGreaterThan(none.killHeal);
    expect(none.boneKnock + none.fleshMend + none.plagueTouch + none.spiritChill).toBe(0);
  });

  it('6 itens ligam a apoteose, 5 não', () => {
    expect(computeMods(baseMods(), [], { bone: 5 }).boneApo).toBe(false);
    const m = (sc: string) => computeMods(baseMods(), [], { [sc]: APOTHEOSIS_AT });
    expect(m('bone').boneApo).toBe(true);
    expect(m('flesh').consumeMax).toBeGreaterThanOrEqual(999);
    expect(m('plague').plagueApo).toBe(true);
    expect(m('spirit').ghostOnDeath).toBe(1);
    expect(m('blood').bloodApo).toBe(true);
  });

  it('o raio deixa o alvo lento com 1 item de espírito', () => {
    const w = new World(setup({ schoolBonus: { spirit: 1 } }));
    const t = w.spawnLiving('soldier', false);
    t.x = w.circle.x;
    t.y = w.circle.y;
    w.necro.castTimer = 0;
    w.update(1 / 60);
    expect(t.chillT ?? 0).toBeGreaterThan(0);
    expect(w.events.some((e) => e.type === 'schoolFx' && e.fx === 'chill')).toBe(true);
  });

  it('Rei Ossudo: esqueleto que cai se remonta depois de 3s', () => {
    const w = new World(setup({ schoolBonus: { bone: APOTHEOSIS_AT } }));
    const skel = () => w.units.filter((u) => u.alive && u.kind === 'skeleton').length;
    const before = skel();
    const s = w.units.find((u) => u.alive && u.kind === 'skeleton')!;
    w.damage(s, 9999);
    w.update(1 / 60);
    expect(skel()).toBe(before - 1);
    step(w, 3.2);
    expect(skel()).toBe(before);
  });

  it('Lorde Vampiro: cura acima do máximo vira escudo, que absorve o dano primeiro', () => {
    const w = new World(setup({ schoolBonus: { blood: APOTHEOSIS_AT } }));
    w.necro.hp = w.necro.maxHp;
    w.healNecro(4);
    expect(w.necro.shield).toBe(4);
    w.healNecro(999);
    expect(w.necro.shield).toBe(w.necro.maxHp * 0.5);
    (w as unknown as { hurtNecro: (d: number, x: number, y: number) => void }).hurtNecro(3, 0, 0);
    expect(w.necro.hp).toBe(w.necro.maxHp);
    expect(w.necro.shield).toBe(w.necro.maxHp * 0.5 - 3);
  });

  it('sem apoteose de sangue a cura não passa do máximo', () => {
    const w = new World(setup());
    w.necro.hp = w.necro.maxHp;
    w.healNecro(5);
    expect(w.necro.shield ?? 0).toBe(0);
  });

  it('partidas com cada apoteose rodam sem travar', () => {
    for (const sc of SCHOOL_ORDER) {
      const w = new World(setup({ seed: 7, schoolBonus: { [sc]: APOTHEOSIS_AT } }));
      step(w, 50);
      expect(w.wave).toBeGreaterThan(0);
    }
  }, 30000);
});
