import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/sim/characters';
import { ITEMS, rollItem } from '../src/sim/items';
import {
  buyCharacter,
  buyFromMarket,
  characterState,
  equip,
  forgeSlot,
  freshMeta,
  gainItem,
  metaMods,
  migrate,
  rollMarket,
  schoolBonus,
  unlockedSchools,
} from '../src/sim/meta';
import { World } from '../src/sim/world';

describe('itens', () => {
  it('ganhar um item repetido sobe o nível e equipa no espaço vazio', () => {
    const m = freshMeta();
    expect(gainItem(m, 'ring_iron')).toBe(0);
    expect(m.equipped.ring1).toBe('ring_iron');
    expect(gainItem(m, 'ring_iron')).toBe(1);
    gainItem(m, 'ring_bone');
    expect(m.equipped.ring2).toBe('ring_bone');
  });

  it('itens equipados mudam os modificadores e contam escola', () => {
    const m = freshMeta();
    gainItem(m, 'cloak_wool');
    gainItem(m, 'ring_bone');
    expect(metaMods(m).necroMaxHp).toBeGreaterThan(freshMeta().settings ? 20 : 0);
    expect(schoolBonus(m).bone).toBe(1);
  });

  it('a forja melhora o espaço e o bônus passa para o próximo item', () => {
    const m = freshMeta();
    gainItem(m, 'staff_yew');
    m.souls = 1000;
    const before = metaMods(m).castCdMul;
    expect(forgeSlot(m, 'staff')).toBe(true);
    expect(m.slots.staff).toBe(1);
    expect(m.items.staff_yew).toBe(0);
    expect(m.souls).toBeLessThan(1000);
    expect(metaMods(m).castCdMul).toBeLessThan(before);
    // troca o cajado: a forja continua valendo
    gainItem(m, 'staff_storm');
    equip(m, 'staff_storm');
    const forged = metaMods(m).necroDmg;
    m.slots.staff = 0;
    expect(metaMods(m).necroDmg).toBeLessThan(forged);
  });

  it('mercado vende e retira o item do estoque', () => {
    const m = freshMeta();
    rollMarket(m, () => 0.1);
    expect(m.market.length).toBeGreaterThan(0);
    m.souls = 10000;
    const id = m.market[0];
    expect(buyFromMarket(m, id)).toBe(true);
    expect(id in m.items).toBe(true);
    expect(m.market).not.toContain(id);
  });

  it('equipar troca o item do espaço', () => {
    const m = freshMeta();
    gainItem(m, 'staff_yew');
    gainItem(m, 'staff_bone');
    expect(m.equipped.staff).toBe('staff_yew');
    expect(equip(m, 'staff_bone')).toBe(true);
    expect(m.equipped.staff).toBe('staff_bone');
  });

  it('todos os itens aplicam sem erro em todos os níveis', () => {
    for (const it of ITEMS) for (let l = 0; l <= 5; l++) {
      const mods = metaMods(freshMeta());
      it.apply(mods, l);
      expect(it.desc(l).length).toBeGreaterThan(3);
    }
    let s = 3;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 200; i++) expect(ITEMS.map((x) => x.id)).toContain(rollItem(r, 1, 'magic'));
  });

  it('migra save v2 sem itens', () => {
    const m = migrate({ version: 2, souls: 50, buildings: { crypts: 1 } });
    expect(m.items).toEqual({});
    expect(m.characters).toContain('necro');
    expect(m.souls).toBe(50);
  });
});

describe('personagens', () => {
  it('desbloqueio e compra', () => {
    const m = freshMeta();
    expect(characterState(m, 'witch')).toBe('locked');
    m.bossesBeaten = 1;
    expect(characterState(m, 'witch')).toBe('buyable');
    m.souls = 500;
    expect(buyCharacter(m, 'witch')).toBe(true);
    expect(characterState(m, 'witch')).toBe('owned');
  });

  it('a bruxa libera praga e conta 1 carta', () => {
    const m = freshMeta();
    m.character = 'witch';
    expect(unlockedSchools(m)).toContain('plague');
    expect(schoolBonus(m).plague).toBe(1);
  });

  it('todos os personagens rodam uma run curta sem erro', () => {
    for (const c of CHARACTERS) {
      const m = freshMeta();
      m.character = c.id;
      const w = new World({ seed: 9, mods: metaMods(m), schools: unlockedSchools(m), schoolBonus: schoolBonus(m) });
      for (let i = 0; i < 60 * 40; i++) w.update(1 / 60);
      expect(w.wave).toBeGreaterThan(0);
    }
  });

  it('o ceifador acerta todos no círculo', () => {
    const m = freshMeta();
    m.character = 'reaper';
    const w = new World({ seed: 1, mods: metaMods(m), schools: ['bone'] });
    const a = w.spawnLiving('soldier', false);
    const b = w.spawnLiving('soldier', false);
    for (const u of [a, b]) {
      u.x = w.circle.x;
      u.y = w.circle.y;
    }
    w.necro.castTimer = 0;
    w.update(1 / 60);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(w.events.some((e) => e.type === 'scythe')).toBe(true);
  });
});
