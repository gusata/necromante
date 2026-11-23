import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { COL } from '../art/palette';
import { pxText } from '../art/text';
import { button, Shaker, transitionIn, transitionTo, type UIButton } from '../fx/juice';
import { buzz } from '../platform/haptics';
import { meta, resetMeta, saveMeta } from '../platform/save';

export class OptionsScene extends Phaser.Scene {
  private shaker!: Shaker;

  constructor() {
    super('Options');
  }

  create() {
    this.shaker = new Shaker(this.cameras.main);
    this.add.image(0, 0, 'ground2').setOrigin(0).setTint(0x8070a0);
    this.add.rectangle(0, 0, 180, 320, 0x050309, 0.75).setOrigin(0);
    pxText(this, 90, 9, 'OPÇÕES', COL.G).setOrigin(0.5).setScale(2);

    const s = meta.settings;
    const onOff = (v: boolean) => (v ? 'LIGADO' : 'DESLIGADO');
    const shakeName = (v: number) => (v === 0 ? 'DESLIGADO' : v < 1 ? 'MÉDIO' : 'FORTE');

    const rows: [string, () => string, () => void][] = [
      ['SONS', () => onOff(s.sfx), () => (s.sfx = !s.sfx)],
      ['MÚSICA', () => onOff(s.music), () => (s.music = !s.music)],
      ['VIBRAÇÃO', () => onOff(s.haptics), () => (s.haptics = !s.haptics)],
      ['TREMOR DE TELA', () => shakeName(s.shake), () => (s.shake = s.shake === 1 ? 0.5 : s.shake === 0.5 ? 0 : 1)],
    ];
    rows.forEach(([label, value, toggle], i) => {
      const y = 60 + i * 40;
      pxText(this, 90, y - 14, label, COL.C).setOrigin(0.5, 0);
      const b: UIButton = button(this, 90, y + 2, value(), () => {
        toggle();
        saveMeta();
        audio.setSfx(s.sfx);
        audio.setMusic(s.music);
        b.label.setText(value());
        if (label === 'VIBRAÇÃO') buzz('heavy');
        if (label === 'TREMOR DE TELA') this.shaker.add(0.6);
      });
    });

    let armed = false;
    const reset = button(
      this,
      90,
      244,
      'APAGAR PROGRESSO',
      () => {
        if (!armed) {
          armed = true;
          reset.label.setText('TOQUE DE NOVO').setTint(COL.R);
          this.time.delayedCall(2500, () => {
            armed = false;
            reset.label.setText('APAGAR PROGRESSO').setTint(COL.C);
          });
          return;
        }
        resetMeta();
        audio.play('bossDeath');
        this.shaker.add(0.8);
        reset.label.setText('APAGADO').setTint(COL.B);
      },
      { color: COL.C },
    );

    pxText(this, 90, 272, 'necromante v0.2', COL.B).setOrigin(0.5);
    button(this, 90, 308, 'VOLTAR', () => transitionTo(this, 'Menu'));
    this.input.keyboard?.once('keydown-ESC', () => transitionTo(this, 'Menu'));
    transitionIn(this);
  }

  update(_t: number, delta: number) {
    this.shaker.update(delta / 1000);
  }
}
