// Exporta os quadros de todos os humanoides (e cores) em JSON, para a folha de revisão (preview.py).
import { BOSS_SPECS, HUMANOIDS, humanoidFrames, undeadColors } from '../../src/art/humanoid';
import { PAL } from '../../src/art/palette';

const out: Record<string, { frames: string[][]; colors: Record<string, string> }> = {};
for (const [k, spec] of Object.entries(HUMANOIDS)) out[k] = { frames: humanoidFrames(spec), colors: { ...PAL, ...spec.colors } };
for (const [k, spec] of Object.entries(BOSS_SPECS)) {
  out[`boss-${k}`] = { frames: humanoidFrames(spec), colors: { ...PAL, ...spec.colors } };
  const und = undeadColors(spec);
  out[`champ-${k}`] = { frames: humanoidFrames(und), colors: { ...PAL, ...und.colors } };
}
process.stdout.write(JSON.stringify(out));
