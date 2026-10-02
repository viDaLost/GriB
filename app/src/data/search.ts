import type { Edibility, Hymenophore, Species } from './types.ts';

export interface SpeciesFilter {
  query?: string;
  edibility?: Edibility[];
  hymenophore?: Hymenophore;
}

/** Нижний регистр, «ё» → «е», без лишних пробелов и дефисов. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[-‐–—]/g, ' ').replace(/\s+/g, ' ').trim();
}

function haystack(s: Species): string[] {
  return [s.nameRu, s.latin, ...s.altNamesRu].map(normalize);
}

/**
 * Поиск по русскому, латинскому и народным названиям.
 * Сначала — совпадения с начала названия, затем — по вхождению.
 */
export function searchSpecies(all: Species[], filter: SpeciesFilter): Species[] {
  const q = filter.query ? normalize(filter.query) : '';
  const matched = all.filter((s) => {
    if (filter.edibility && filter.edibility.length > 0 && !filter.edibility.includes(s.edibility)) {
      return false;
    }
    if (filter.hymenophore && s.hymenophore !== filter.hymenophore) return false;
    return q === '' || haystack(s).some((h) => h.includes(q));
  });
  if (q === '') return matched;

  const rank = (s: Species) =>
    haystack(s).some((h) => h.startsWith(q) || h.split(' ').some((w) => w.startsWith(q))) ? 0 : 1;
  return matched
    .map((s, i) => ({ s, i, r: rank(s) }))
    .sort((x, y) => x.r - y.r || x.i - y.i)
    .map((x) => x.s);
}
