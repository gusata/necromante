import Phaser from 'phaser';
import { audio } from './audio/audio';
import { DEBUG } from './debug';
import { BestiaryScene } from './scenes/BestiaryScene';
import { BootScene } from './scenes/BootScene';
import { CharactersScene } from './scenes/CharactersScene';
import { GraveyardScene } from './scenes/GraveyardScene';
import { MenuScene } from './scenes/MenuScene';
import { OptionsScene } from './scenes/OptionsScene';
import { RunScene } from './scenes/RunScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  // resolução base em pixels de arte; o Phaser escala para a tela
  width: 180,
  height: 320,
  backgroundColor: '#050309',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, CharactersScene, GraveyardScene, BestiaryScene, OptionsScene, RunScene],
});

if (DEBUG.fps) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:4px;left:4px;color:#aef5bf;font:12px monospace;z-index:9;pointer-events:none';
  document.body.appendChild(el);
  setInterval(() => (el.textContent = `${Math.round(game.loop.actualFps)} fps`), 500);
}

// acesso pelo console do navegador para depuração
(window as unknown as { __game: Phaser.Game }).__game = game;
(window as unknown as { __audio: typeof audio }).__audio = audio;
