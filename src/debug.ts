/**
 * Parâmetros de debug na URL:
 *   ?run          pula o menu
 *   ?auto         o jogo se joga sozinho
 *   ?scene=Nome   abre uma cena direto (Graveyard, Bestiary, Options)
 *   ?wave=N       começa na onda N
 *   ?meta=N       finge meta-progressão no nível N
 *   ?fps          mostra o contador de quadros por segundo
 *   ?tab=market   aba inicial do cemitério (build, market, arsenal)
 *   ?char=reaper  joga com um personagem (necro, witch, digger, reaper, vampire)
 */
const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const DEBUG = {
  skipMenu: q.has('run') || q.has('wave'),
  autopilot: q.has('auto'),
  scene: q.get('scene'),
  startWave: Number(q.get('wave') ?? 0),
  metaLevel: q.has('meta') ? Number(q.get('meta')) : null,
  fps: q.has('fps'),
  tab: q.get('tab'),
  char: q.get('char'),
};
