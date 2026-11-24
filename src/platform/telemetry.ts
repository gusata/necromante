import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { meta } from './save';

/**
 * Telemetria de teste: cada run vira uma linha no Supabase (tabela `runs`), e erros vão para `errors`.
 * A chave é a "publishable": dentro do APK ela é pública, e o banco só deixa inserir (ninguém lê de fora).
 * Sem internet, as linhas ficam numa fila no aparelho e saem na próxima vez que der.
 * Desliga em Opções (meta.settings.telemetry).
 */
const API = 'https://uffcocodeiltgxvtcjye.supabase.co/rest/v1';
const KEY = 'sb_publishable_jShh0imvRFpiaX5KgtgG-Q_nmjaalQ7';

const QUEUE_KEY = 'necromante.telemetry.queue';
const HISTORY_KEY = 'necromante.telemetry.history';
const DEVICE_KEY = 'necromante.device';
const MAX_QUEUE = 200;
const MAX_HISTORY = 40;

export const APP_VERSION: string = __APP_VERSION__;

type Table = 'runs' | 'errors';
interface Row {
  /** id local, só para tirar da fila o que já foi */
  qid: string;
  table: Table;
  row: Record<string, unknown>;
}

const read = <T>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // cheio ou bloqueado: perde o registro, o jogo segue
  }
};

/** ID aleatório do aparelho (nada pessoal). Aparece em Opções para o testador te dizer qual é o dele. */
export function deviceId(): string {
  let id = read<string | null>(DEVICE_KEY, null);
  if (!id) {
    id = Array.from({ length: 8 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    write(DEVICE_KEY, id);
  }
  return id;
}

const enabled = () => meta.settings.telemetry !== false;

function enqueue(table: Table, row: Record<string, unknown>) {
  if (!enabled()) return;
  const q = read<Row[]>(QUEUE_KEY, []);
  q.push({ qid: `${Date.now()}-${Math.random()}`, table, row: { device: deviceId(), version: APP_VERSION, ...row } });
  write(QUEUE_KEY, q.slice(-MAX_QUEUE));
  void flush();
}

let flushing = false;

/** Manda a fila. Chamado ao abrir o jogo, ao fim de cada run e quando a internet volta. */
export async function flush(): Promise<void> {
  if (flushing || !enabled() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  const q = read<Row[]>(QUEUE_KEY, []);
  if (!q.length) return;
  flushing = true;
  try {
    for (const table of ['runs', 'errors'] as Table[]) {
      const rows = q.filter((r) => r.table === table);
      if (!rows.length) continue;
      const res = await fetch(`${API}/${table}`, {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(rows.map((r) => r.row)),
      });
      // linha malformada ou grande demais (400/413/422): o banco nunca vai aceitar, sai da fila.
      // o resto (sem tabela, chave errada, servidor fora) fica na fila para a próxima tentativa
      if (!res.ok && ![400, 413, 422].includes(res.status)) continue;
      const done = new Set(rows.map((r) => r.qid));
      write(
        QUEUE_KEY,
        read<Row[]>(QUEUE_KEY, []).filter((r) => !done.has(r.qid)),
      );
    }
  } catch {
    // sem rede: tenta de novo depois
  } finally {
    flushing = false;
  }
}

/** Resumo de uma run (morte, desistência ou saída no meio). */
export function logRun(outcome: 'death' | 'quit' | 'exit', wave: number, character: string, data: Record<string, unknown>) {
  const entry = { at: new Date().toISOString(), outcome, wave, character, data };
  write(HISTORY_KEY, [...read<unknown[]>(HISTORY_KEY, []), entry].slice(-MAX_HISTORY));
  enqueue('runs', { outcome, wave, character, data });
}

const seenErrors = new Set<string>();

/** Erro de JavaScript (um de cada tipo por sessão). */
export function logError(message: string, data: Record<string, unknown> = {}) {
  const key = message.slice(0, 200);
  if (seenErrors.has(key) || seenErrors.size > 20) return;
  seenErrors.add(key);
  const entry = { at: new Date().toISOString(), message: key, data };
  write(HISTORY_KEY, [...read<unknown[]>(HISTORY_KEY, []), { error: entry }].slice(-MAX_HISTORY));
  enqueue('errors', { message: key, data });
}

/** Informações do aparelho que ajudam a entender desempenho. */
export function deviceInfo() {
  return {
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    w: typeof screen !== 'undefined' ? screen.width : 0,
    h: typeof screen !== 'undefined' ? screen.height : 0,
    dpr: typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1,
    platform: Capacitor.getPlatform(),
  };
}

/** Botão "exportar log": compartilha as últimas runs (WhatsApp, e-mail...). Sem rede nenhuma envolvida. */
export async function exportLog(): Promise<'shared' | 'copied' | 'failed'> {
  const body = JSON.stringify({ device: deviceId(), version: APP_VERSION, info: deviceInfo(), entries: read<unknown[]>(HISTORY_KEY, []) }, null, 1);
  const name = `necromante-log-${deviceId()}.json`;
  try {
    if (Capacitor.isNativePlatform()) {
      const file = await Filesystem.writeFile({ path: name, data: body, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: 'log do necromante', files: [file.uri] });
      return 'shared';
    }
    await navigator.clipboard.writeText(body);
    return 'copied';
  } catch {
    try {
      await navigator.clipboard.writeText(body);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}

/** Liga os ganchos globais: erros não tratados e reenvio quando a internet volta. */
export function installTelemetry(activeScenes: () => string[]) {
  window.addEventListener('error', (e) => logError(e.message || 'erro', { stack: String(e.error?.stack ?? '').slice(0, 1500), src: `${e.filename}:${e.lineno}`, scenes: activeScenes() }));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    logError(r?.message ?? String(e.reason), { stack: String(r?.stack ?? '').slice(0, 1500), scenes: activeScenes(), promise: true });
  });
  window.addEventListener('online', () => void flush());
  void flush();
}
