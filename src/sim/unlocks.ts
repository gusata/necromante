import { HOARD_ITEMS } from './items';
import type { MetaState } from './meta';

/**
 * As telas da meta abrem aos poucos, para o jogador novo não encarar
 * almas, itens, forja, gemas, árvore e tesouro de uma vez.
 * Cada tela tem a condição para abrir, o aviso enquanto está fechada e
 * uma frase de apresentação mostrada na primeira visita.
 */
export type PageId = 'market' | 'arsenal' | 'tree' | 'altar' | 'hoard' | 'bestiary' | 'records' | 'daily';

export interface PageUnlock {
  id: PageId;
  /** texto curto enquanto está fechada */
  need: string;
  /** apresentação de uma linha na primeira visita */
  intro: string;
  open: (m: MetaState) => boolean;
}

const hasGem = (m: MetaState) => Object.values(m.gems).some((n) => n > 0) || m.sockets.some((s) => !!s);

export const PAGES: Record<PageId, PageUnlock> = {
  tree: {
    id: 'tree',
    need: 'abre depois da 1ª run',
    intro: 'gaste almas aqui: cada nó da árvore vale para todas as runs.',
    open: (m) => m.runs >= 1,
  },
  bestiary: {
    id: 'bestiary',
    need: 'abre depois da 1ª run',
    intro: 'tudo que você já matou e o que cada vivo faz.',
    open: (m) => m.runs >= 1,
  },
  records: {
    id: 'records',
    need: 'abre depois da 1ª run',
    intro: 'suas runs, recordes e conquistas.',
    open: (m) => m.runs >= 1,
  },
  daily: {
    id: 'daily',
    need: 'abre depois da 1ª run',
    intro: 'uma run por dia, igual para todo mundo.',
    open: (m) => m.runs >= 1,
  },
  arsenal: {
    id: 'arsenal',
    need: 'abre quando cair o 1º item',
    intro: 'equipe o que caiu nas runs. cada escola cresce com 1, 2, 4 e 6 itens: toque numa escola para ver.',
    open: (m) => Object.keys(m.items).length > 0,
  },
  market: {
    id: 'market',
    need: 'abre depois da 2ª run',
    intro: 'o coveiro vende itens por almas. a vitrine muda.',
    open: (m) => m.runs >= 2 || m.bossesBeaten >= 1,
  },
  altar: {
    id: 'altar',
    need: 'abre quando cair a 1ª gema',
    intro: 'encaixe gemas para bônus fixos. gemas iguais se fundem numa melhor.',
    open: hasGem,
  },
  hoard: {
    id: 'hoard',
    need: 'abre com a 1ª relíquia ou conjunto',
    intro: 'relíquias e conjuntos dão bônus mesmo guardados.',
    open: (m) => HOARD_ITEMS().some((it) => it.id in m.items),
  },
};

export const pageOpen = (m: MetaState, id: string) => !(id in PAGES) || PAGES[id as PageId].open(m);

/** aberta, mas o jogador ainda não entrou: ganha o pontinho de novidade */
export const pageNew = (m: MetaState, id: string) => id in PAGES && pageOpen(m, id) && !m.seenPages.includes(id);

/** Saves antigos: o que já estava aberto conta como visto (sem pontinhos nem apresentações). */
export function seenFromProgress(m: MetaState): string[] {
  return (Object.keys(PAGES) as PageId[]).filter((id) => PAGES[id].open(m));
}
