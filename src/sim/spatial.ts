import type { Faction, Unit } from './types';

/**
 * Grade espacial uniforme: troca as buscas O(n) por unidade (alvo mais perto,
 * área de efeito, separação) por uma olhada nas células vizinhas.
 * Reconstruída do zero a cada passo, o que é barato e evita bugs de atualização.
 */
export class SpatialGrid {
  readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly minY: number;
  private readonly buckets: Unit[][];
  /** maior raio inserido neste passo (para a separação) */
  maxRadius = 0;

  constructor(w: number, h: number, cell = 16, minY = -32) {
    this.cell = cell;
    this.minY = minY;
    this.cols = Math.ceil(w / cell) + 1;
    this.rows = Math.ceil((h - minY) / cell) + 1;
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  private cx(x: number) {
    const c = Math.floor(x / this.cell);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }
  private cy(y: number) {
    const c = Math.floor((y - this.minY) / this.cell);
    return c < 0 ? 0 : c >= this.rows ? this.rows - 1 : c;
  }

  clear() {
    for (const b of this.buckets) b.length = 0;
    this.maxRadius = 0;
  }

  insert(u: Unit) {
    this.buckets[this.cy(u.y) * this.cols + this.cx(u.x)].push(u);
    if (u.radius > this.maxRadius) this.maxRadius = u.radius;
  }

  /** Chama `fn` para cada unidade nas células que tocam o quadrado (x±r, y±r). Não filtra distância. */
  each(x: number, y: number, r: number, fn: (u: Unit) => void) {
    const x0 = this.cx(x - r);
    const x1 = this.cx(x + r);
    const y0 = this.cy(y - r);
    const y1 = this.cy(y + r);
    for (let j = y0; j <= y1; j++) {
      const row = j * this.cols;
      for (let i = x0; i <= x1; i++) {
        const b = this.buckets[row + i];
        for (let k = 0; k < b.length; k++) fn(b[k]);
      }
    }
  }

  /** Unidade viva mais perto dentro de `range`, com filtro opcional. */
  nearest(x: number, y: number, range: number, skip: Unit | null, filter?: (o: Unit) => boolean): Unit | undefined {
    let best: Unit | undefined;
    let bestD = range * range;
    this.each(x, y, range, (o) => {
      if (!o.alive || o === skip) return;
      const d = (o.x - x) ** 2 + (o.y - y) ** 2;
      // desempate por id: o resultado não depende da ordem das células
      if (d < bestD || (d === bestD && (!best || o.id < best.id))) {
        if (filter && !filter(o)) return;
        bestD = d;
        best = o;
      }
    });
    return best;
  }
}

/** Uma grade por facção + uma com todos (para a separação). */
export class FactionGrids {
  readonly all: SpatialGrid;
  readonly by: Record<Faction, SpatialGrid>;
  private counts: Record<Faction, number> = { living: 0, dead: 0 };

  constructor(w: number, h: number) {
    this.all = new SpatialGrid(w, h);
    this.by = { living: new SpatialGrid(w, h), dead: new SpatialGrid(w, h) };
  }

  rebuild(units: Unit[]) {
    this.all.clear();
    this.by.living.clear();
    this.by.dead.clear();
    this.counts.living = 0;
    this.counts.dead = 0;
    for (const u of units) {
      if (!u.alive) continue;
      this.all.insert(u);
      this.by[u.faction].insert(u);
      this.counts[u.faction]++;
    }
  }

  /** unidades vivas da facção na última reconstrução */
  count(f: Faction): number {
    return this.counts[f];
  }
}
