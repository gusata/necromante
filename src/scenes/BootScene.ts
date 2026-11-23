import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { generateArt } from '../art/generate';
import { DEBUG } from '../debug';
import { loadMeta, meta } from '../platform/save';
import { BUILDINGS } from '../sim/meta';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  async create() {
    const t0 = performance.now();
    generateArt(this);
    (window as unknown as { __bootMs: number }).__bootMs = Math.round(performance.now() - t0);
    await loadMeta();
    if (DEBUG.metaLevel !== null) {
      // só em memória: saveMeta grava, então desliga o salvamento trocando a chave não é preciso para testes rápidos
      for (const b of BUILDINGS) meta.buildings[b.id] = Math.min(DEBUG.metaLevel, b.costs.length);
      meta.bossesBeaten = Math.min(4, DEBUG.metaLevel);
      if (DEBUG.metaLevel > 0) {
        meta.champions = { woodcutter: 2, abbot: 1, commander: 1, archbishop: 1 };
        meta.selectedChampion = 'woodcutter';
        meta.souls = 999;
        meta.kills = { peasant: 160, hound: 60, torch: 20, militia: 12, monk: 30, priest: 8 };
      }
    }
    audio.setSfx(meta.settings.sfx);
    audio.setMusic(meta.settings.music);
    // o navegador só libera áudio depois de um gesto do usuário
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.scene.start(DEBUG.scene ?? (DEBUG.skipMenu ? 'Run' : 'Menu'));
  }
}
