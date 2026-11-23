/** Parâmetros de debug na URL: ?run (pula o menu), ?auto (círculo se move sozinho). */
const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const DEBUG = {
  skipMenu: q.has('run'),
  autopilot: q.has('auto'),
};
