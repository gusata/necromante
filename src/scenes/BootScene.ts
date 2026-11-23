import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { applySheets, queueManifest, queueSheets } from '../art/aseprite';
import { generateArt } from '../art/generate';
import { DEBUG } from '../debug';
import { loadMeta, meta } from '../platform/save';
import { BUILDINGS } from '../sim/meta';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // o manifesto é opcional: sem ele, toda a arte é a gerada no código
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.info(`[boot] sem ${file.key}`));
    queueManifest(this);
  }

  /** Carrega as spritesheets do Aseprite listadas no manifesto. */
  private loadSheets(): Promise<string[]> {
    const entries = queueSheets(this);
    if (!entries.length) return Promise.resolve([]);
    return new Promise((resolve) => {
      this.load.once('complete', () => resolve(applySheets(this, entries)));
      this.load.start();
    });
  }

  async create() {
    const t0 = performance.now();
    generateArt(this);
    const replaced = await this.loadSheets();
    if (replaced.length) console.info(`[aseprite] ${replaced.length} texturas substituídas: ${replaced.join(', ')}`);
    (window as unknown as { __aseprite: string[] }).__aseprite = replaced;
    (window as unknown as { __bootMs: number }).__bootMs = Math.round(performance.now() - t0);
    await loadMeta();
    if (DEBUG.metaLevel !== null) {
      // atenção: se a run terminar, o resultado é salvo por cima do progresso real
      for (const b of BUILDINGS) meta.buildings[b.id] = Math.min(DEBUG.metaLevel, b.costs.length);
      meta.bossesBeaten = Math.min(4, DEBUG.metaLevel);
      if (DEBUG.metaLevel > 0) {
        meta.champions = { woodcutter: 2, abbot: 1, commander: 1, archbishop: 1 };
        meta.selectedChampion = 'woodcutter';
        meta.souls = 999;
        meta.kills = { peasant: 160, hound: 60, torch: 20, militia: 12, monk: 30, priest: 8 };
        meta.items = { staff_storm: 2, hood_worn: 0, cloak_crimson: 1, ring_bone: 0, ring_iron: 3, amulet_tooth: 0, hood_lich: 0 };
        meta.equipped = { staff: 'staff_storm', hood: 'hood_worn', cloak: 'cloak_crimson', ring1: 'ring_bone', ring2: 'ring_iron', amulet: 'amulet_tooth' };
        meta.characters = ['necro', 'witch', 'digger'];
      }
    }
    audio.setSfx(meta.settings.sfx);
    audio.setMusic(meta.settings.music);
    // o navegador só libera áudio depois de um gesto do usuário
    // captura + vários eventos: o iOS só libera em touchend/click, e o Phaser pode consumir o pointerdown
    const unlock = () => audio.unlock();
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown']) {
      document.addEventListener(ev, unlock, { capture: true, passive: true });
    }
    if (DEBUG.char) meta.character = DEBUG.char as typeof meta.character;
    this.scene.start(DEBUG.scene ?? (DEBUG.skipMenu ? 'Run' : 'Menu'), DEBUG.tab ? { tab: DEBUG.tab } : undefined);
  }
}
