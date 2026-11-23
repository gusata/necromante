import Phaser from 'phaser';
import { BestiaryScene } from './scenes/BestiaryScene';
import { BootScene } from './scenes/BootScene';
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
  scene: [BootScene, MenuScene, GraveyardScene, BestiaryScene, OptionsScene, RunScene],
});

// acesso pelo console do navegador para depuração
(window as unknown as { __game: Phaser.Game }).__game = game;
