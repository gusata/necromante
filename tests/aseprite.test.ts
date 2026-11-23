import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { frameMapping, parseAse } from '../src/art/aseprite';

const sample = JSON.parse(readFileSync('docs/exemplo-aseprite/test-peasant.json', 'utf8'));

describe('pipeline do Aseprite', () => {
  it('lê quadros e tags do formato Array', () => {
    const { names, tags } = parseAse(sample);
    expect(names).toHaveLength(3);
    expect(tags.walk).toEqual([0, 1]);
    expect(tags.attack).toEqual([2]);
  });

  it('lê o formato Hash', () => {
    const hash = { frames: Object.fromEntries(sample.frames.map((f: { filename: string }) => [f.filename, f])), meta: sample.meta };
    expect(parseAse(hash).names).toEqual(sample.frames.map((f: { filename: string }) => f.filename));
  });

  it('mapeia tags para as chaves de textura das unidades', () => {
    const { tags } = parseAse(sample);
    expect(frameMapping({ key: 'peasant', file: 'x' }, tags)).toEqual({ peasant0: 0, peasant1: 1, peasant2: 2 });
  });

  it('sem tags usa os quadros 0, 1 e 2', () => {
    expect(frameMapping({ key: 'monk', file: 'x' }, {})).toEqual({ monk0: 0, monk1: 1, monk2: 2 });
  });

  it('aceita mapeamento explícito', () => {
    expect(frameMapping({ file: 'x', frames: { necro0: 0, 'necro-cast': 2 } }, {})).toEqual({ necro0: 0, 'necro-cast': 2 });
  });
});
