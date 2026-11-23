import Phaser from 'phaser';
import { generateArt } from '../art/generate';
import { DEBUG } from '../debug';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    generateArt(this);
    this.scene.start(DEBUG.skipMenu ? 'Run' : 'Menu');
  }
}
