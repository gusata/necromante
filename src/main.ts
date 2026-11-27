import Phaser from 'phaser';
import { audio } from './audio/audio';
import { ZOOM } from './art/aseprite';
import { DEBUG } from './debug';
import { installTelemetry } from './platform/telemetry';
import { BestiaryScene } from './scenes/BestiaryScene';
import { BootScene } from './scenes/BootScene';
import { GraveyardScene } from './scenes/GraveyardScene';
import { MenuScene } from './scenes/MenuScene';
import { OptionsScene } from './scenes/OptionsScene';
import { RecordsScene } from './scenes/RecordsScene';
import { RunScene } from './scenes/RunScene';
import { baseScrollY, VIEW_H, VIEW_W } from './fx/view';

const game = new Phaser.Game({
  // WebGL: a arte em resolução dupla depende dele (veja setArtRes)
  type: Phaser.WEBGL,
  parent: 'game',
  // tela em 360 x (2 * VIEW_H); o mundo tem 180 de largura e a câmera mostra tudo com zoom 2.
  // a altura acompanha o formato do celular (src/fx/view.ts), sem faixa preta.
  // a arte usa uma grade só, a do mundo (veja ART_RES em src/art/aseprite.ts e docs/ARTE.md)
  width: VIEW_W * ZOOM,
  height: VIEW_H * ZOOM,
  backgroundColor: '#050309',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, GraveyardScene, BestiaryScene, RecordsScene, OptionsScene, RunScene],
});

// toda cena enxerga o mundo com câmera de origem no canto e zoom 2; a rolagem põe o y 0 abaixo do notch
// (na partida, a sobra de altura aparece acima do campo)
game.events.once(Phaser.Core.Events.READY, () => {
  for (const scene of game.scene.scenes) zoomScene(scene);
});
function zoomScene(scene: Phaser.Scene) {
  const apply = () => scene.cameras?.main?.setOrigin(0, 0).setZoom(ZOOM).setScroll(0, baseScrollY(scene.scene.key));
  // a cena de carregamento já pode ter começado quando o jogo fica pronto
  apply();
  scene.events.on(Phaser.Scenes.Events.START, apply);
  scene.events.on(Phaser.Scenes.Events.CREATE, apply);
}

installTelemetry(() => game.scene.getScenes(true).map((s) => s.scene.key));

if (DEBUG.fps) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:4px;left:4px;color:#aef5bf;font:12px monospace;z-index:9;pointer-events:none';
  document.body.appendChild(el);
  setInterval(() => (el.textContent = `${Math.round(game.loop.actualFps)} fps`), 500);
}

// acesso pelo console do navegador para depuração
(window as unknown as { __game: Phaser.Game }).__game = game;
(window as unknown as { __audio: typeof audio }).__audio = audio;
