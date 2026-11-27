import { describe, expect, it } from 'vitest';
import { autopilot } from '../src/sim/autopilot';
import { MASTERY_AT } from '../src/sim/cards';
import { WAVE_THEMES } from '../src/sim/events';
import { GIFT_BY_ID, GIFT_FIRST, GIFTS, giftCost, rollGifts } from '../src/sim/gifts';
import { freshMeta, migrate } from '../src/sim/meta';
import { baseMods } from '../src/sim/mods';
import { pageNew, pageOpen } from '../src/sim/unlocks';
import { type RunSetup, World } from '../src/sim/world';

const setup = (over: Partial<RunSetup> = {}): RunSetup => ({ seed: 11, mods: baseMods(), schools: ['bone', 'flesh', 'plague', 'spirit', 'blood'], ...over });
const step = (w: World, seconds: number) => {
  for (let i = 0; i < seconds * 60 && w.phase !== 'over'; i++) {
    autopilot(w);
    w.update(1 / 60);
  }
};

describe('dádivas', () => {
  it('são oferecidas no fim da onda depois de bastante abate', () => {
    const w = new World(setup());
    let offered = false;
    for (let i = 0; i < 60 * 60 * 4 && w.phase !== 'over'; i++) {
      if (w.phase === 'event' && w.event?.id === 'gift') {
        offered = true;
        break;
      }
      autopilot(w);
      w.update(1 / 60);
    }
    expect(offered).toBe(true);
    expect(w.kills).toBeGreaterThanOrEqual(GIFT_FIRST);
    expect(w.event?.choices).toHaveLength(3);
    const before = w.nextGiftAt;
    w.resolveEvent(0);
    expect(w.gifts).toHaveLength(1);
    expect(w.nextGiftAt).toBe(before + giftCost(1));
  });

  it('duas dádivas da mesma escola dão a maestria no meio da run', () => {
    const w = new World(setup());
    expect(w.schoolCounts().bone).toBe(0);
    w.takeGift('b_marrow');
    w.takeGift('b_quiver');
    expect(w.schoolCounts().bone).toBe(MASTERY_AT);
    expect(w.mods.raisePool.archer).toBeGreaterThan(0);
    expect(w.events.some((e) => e.type === 'synergy' && e.school === 'bone')).toBe(true);
  });

  it('o sorteio respeita o máximo e as escolas liberadas', () => {
    const taken = GIFTS.filter((g) => !g.school).flatMap((g) => Array(g.max).fill(g.id));
    for (let s = 0; s < 50; s++) {
      const r = rollGifts(Math.random, taken, ['bone'], { bone: 0, flesh: 0, plague: 0, spirit: 0, blood: 0 });
      for (const id of r) expect(GIFT_BY_ID[id].school).toBe('bone');
      expect(new Set(r).size).toBe(r.length);
    }
  });

  it('salvar e retomar guarda as dádivas e as escolas delas', () => {
    const w = new World(setup());
    w.takeGift('v_thirst');
    w.takeGift('v_rage');
    const r = World.restore(JSON.parse(JSON.stringify(w.snapshot())));
    expect(r.gifts).toEqual(['v_thirst', 'v_rage']);
    expect(r.schoolCounts().blood).toBe(2);
    expect(r.mods.lifesteal).toBeCloseTo(w.mods.lifesteal);
  });
});

describe('postura', () => {
  it('na defesa os mortos ficam perto do altar e levam menos dano', () => {
    const w = new World(setup());
    w.setCircle(90, 80);
    step(w, 2);
    expect(w.setStance('guard')).toBe(true);
    expect(w.setStance('guard')).toBe(false);
    w.phase = 'intermission';
    w.phaseTimer = 99;
    for (let i = 0; i < 60 * 12; i++) w.update(1 / 60);
    const dead = w.units.filter((u) => u.alive && u.faction === 'dead');
    const avgY = dead.reduce((a, u) => a + u.y, 0) / dead.length;
    expect(avgY).toBeGreaterThan(200);
    const u = dead[0];
    const hp = u.hp;
    w.damage(u, 1);
    expect(hp - u.hp).toBeLessThan(1);
  });
});

describe('variedade', () => {
  it('ondas temáticas aparecem e mudam a onda', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 40 && seen.size < 3; seed++) {
      const w = new World(setup({ seed }));
      for (let n = 2; n <= 5; n++) {
        w.startWave(n);
        if (w.theme) seen.add(w.theme);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
    for (const id of seen) expect(WAVE_THEMES.some((t) => t.id === id)).toBe(true);
  });

  it('elites ganham afixo a partir da 4ª onda', () => {
    const w = new World(setup());
    w.wave = 8;
    w.waveFx.elites = 200;
    const affixes = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const u = w.spawnLiving('peasant');
      if (u.affix) affixes.add(u.affix);
    }
    expect(affixes.size).toBe(4);
  });

  it('cães sempre correm para o altar', () => {
    const w = new World(setup());
    expect(w.spawnLiving('hound').rush).toBe(true);
  });
});

describe('telas aos poucos', () => {
  it('jogador novo vê só o início; cada tela abre com o progresso', () => {
    const m = freshMeta();
    expect(pageOpen(m, 'home')).toBe(true);
    expect(pageOpen(m, 'tree')).toBe(false);
    expect(pageOpen(m, 'arsenal')).toBe(false);
    m.runs = 1;
    expect(pageOpen(m, 'tree')).toBe(true);
    expect(pageNew(m, 'tree')).toBe(true);
    m.seenPages.push('tree');
    expect(pageNew(m, 'tree')).toBe(false);
    m.items.ring_iron = 0;
    expect(pageOpen(m, 'arsenal')).toBe(true);
    expect(pageOpen(m, 'altar')).toBe(false);
    m.gems.ruby1 = 1;
    expect(pageOpen(m, 'altar')).toBe(true);
  });

  it('save antigo não ganha apresentações do que já estava aberto', () => {
    const old = { ...freshMeta(), version: 6, runs: 5, items: { ring_iron: 0 } } as Record<string, unknown>;
    delete old.seenPages;
    const m = migrate(old);
    expect(m.seenPages).toContain('tree');
    expect(m.seenPages).toContain('arsenal');
    expect(pageNew(m, 'tree')).toBe(false);
  });
});
