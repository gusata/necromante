/**
 * Parâmetros de debug na URL:
 *   ?run          pula o menu
 *   ?auto         o jogo se joga sozinho
 *   ?scene=Nome   abre uma cena direto (Graveyard, Bestiary, Options)
 *   ?wave=N       começa na onda N
 *   ?meta=N       finge meta-progressão no nível N (não salva)
 */
const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const DEBUG = {
  skipMenu: q.has('run') || q.has('wave'),
  autopilot: q.has('auto'),
  scene: q.get('scene'),
  startWave: Number(q.get('wave') ?? 0),
  metaLevel: q.has('meta') ? Number(q.get('meta')) : null,
};
