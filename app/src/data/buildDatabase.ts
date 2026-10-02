import type { Lookalike, Species } from './types.ts';

/** Запись вида в JSON — без двойников: они хранятся отдельными парами. */
export type SpeciesRecord = Omit<Species, 'lookalikes'>;

/** Пара похожих видов. Связь симметрична: A похож на B, B — на A. */
export interface LookalikePair {
  a: string;
  b: string;
  howToTell: string;
}

export interface SpeciesDb {
  all: Species[];
  get(id: string): Species | undefined;
}

export function buildDatabase(records: SpeciesRecord[], pairs: LookalikePair[]): SpeciesDb {
  const lookalikes = new Map<string, Lookalike[]>();
  const link = (from: string, to: string, howToTell: string) => {
    const list = lookalikes.get(from) ?? [];
    list.push({ id: to, howToTell });
    lookalikes.set(from, list);
  };
  for (const p of pairs) {
    link(p.a, p.b, p.howToTell);
    link(p.b, p.a, p.howToTell);
  }

  const all: Species[] = records
    .map((r) => ({ ...r, lookalikes: lookalikes.get(r.id) ?? [] }))
    .sort((x, y) => x.nameRu.localeCompare(y.nameRu, 'ru'));
  const byId = new Map(all.map((s) => [s.id, s]));

  return { all, get: (id) => byId.get(id) };
}
