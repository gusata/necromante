import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { COL } from '../art/palette';
import { pxText } from '../art/text';
import { button, Shaker, transitionIn, transitionTo, type UIButton } from '../fx/juice';
import { buzz } from '../platform/haptics';
import { meta, resetMeta, saveMeta } from '../platform/save';
import { APP_VERSION, deviceId, exportLog } from '../platform/telemetry';
import { navBar } from './nav';

export class OptionsScene extends Phaser.Scene {
  private shaker!: Shaker;

  constructor() {
    super('Options');
  }

  create() {
    this.shaker = new Shaker(this.cameras.main);
    this.add.image(0, 0, 'ground2').setOrigin(0).setTint(0xb08870);
    this.add.rectangle(0, 0, 180, 320, 0x0b0806, 0.75).setOrigin(0);
    navBar(this, 'options');

    const s = meta.settings;
    const onOff = (v: boolean) => (v ? 'LIGADO' : 'DESLIGADO');
    const shakeName = (v: number) => (v === 0 ? 'DESLIGADO' : v < 1 ? 'MÉDIO' : 'FORTE');

    const rows: [string, () => string, () => void][] = [
      ['SONS', () => onOff(s.sfx), () => (s.sfx = !s.sfx)],
      ['MÚSICA', () => onOff(s.music), () => (s.music = !s.music)],
      ['VIBRAÇÃO', () => onOff(s.haptics), () => (s.haptics = !s.haptics)],
      ['TREMOR DE TELA', () => shakeName(s.shake), () => (s.shake = s.shake === 1 ? 0.5 : s.shake === 0.5 ? 0 : 1)],
      ['MIRA', () => (s.aim === 'direct' ? 'TOCAR DIRETO' : 'ARRASTAR'), () => (s.aim = s.aim === 'direct' ? 'drag' : 'direct')],
      ['ESTATÍSTICAS ANÔNIMAS', () => onOff(s.telemetry !== false), () => (s.telemetry = s.telemetry === false)],
    ];
    rows.forEach(([label, value, toggle], i) => {
      const y = 46 + i * 30;
      pxText(this, 90, y - 14, label, COL.v).setOrigin(0.5, 0);
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

    // log das últimas runs, para o testador mandar por WhatsApp/e-mail
    const exp: UIButton = button(this, 90, 236, 'EXPORTAR LOG', async () => {
      const r = await exportLog();
      exp.label.setText(r === 'shared' ? 'ENVIADO' : r === 'copied' ? 'COPIADO' : 'NÃO DEU').setTint(r === 'failed' ? COL.R : COL.G);
      this.time.delayedCall(2000, () => exp.label.setText('EXPORTAR LOG').setTint(COL.v));
    }, { color: COL.v });

    let armed = false;
    const reset = button(
      this,
      90,
      262,
      'APAGAR PROGRESSO',
      () => {
        if (!armed) {
          armed = true;
          reset.label.setText('TOQUE DE NOVO').setTint(COL.R);
          this.time.delayedCall(2500, () => {
            armed = false;
            reset.label.setText('APAGAR PROGRESSO').setTint(COL.v);
          });
          return;
        }
        resetMeta();
        audio.play('bossDeath');
        this.shaker.add(0.8);
        reset.label.setText('APAGADO').setTint(COL.B);
      },
      { color: COL.v },
    );

    pxText(this, 90, 284, `necromante v${APP_VERSION}`, COL.B).setOrigin(0.5);
    pxText(this, 90, 293, `id: ${deviceId()}`, COL.B).setOrigin(0.5);
    pxText(this, 90, 304, 'as estatísticas ajudam a equilibrar o jogo', 0x4a3524).setOrigin(0.5);
    this.input.keyboard?.once('keydown-ESC', () => transitionTo(this, 'Menu'));
    transitionIn(this);
  }

  update(_t: number, delta: number) {
    this.shaker.update(delta / 1000);
  }
}
