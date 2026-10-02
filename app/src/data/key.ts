import type { SpeciesDb } from './buildDatabase.ts';
import {
  answeredCount,
  answerValue,
  isApplicable,
  QUESTIONS,
  traitMatch,
  type KeyAnswers,
} from './questions.ts';
import { isInSeason } from './season.ts';
import type { Traits } from './traits.ts';
import { isDangerous, type Species } from './types.ts';

export type { KeyAnswers } from './questions.ts';

export interface KeyMatch {
  species: Species;
  /** Доля совпавших признаков, 0..1 */
  match: number;
  inSeason: boolean | null;
}

export interface KeyResult {
  /** Лучшие совпадения по убыванию */
  matches: KeyMatch[];
  /** Ядовитые виды с заметным совпадением — показываются всегда, отдельно */
  dangerous: KeyMatch[];
  answered: number;
}

/** С какого совпадения вид показывается */
export const KEY_MIN_MATCH = 0.5;
/** С какого совпадения ядовитый вид попадает в блок предупреждений */
export const KEY_DANGER_MATCH = 0.6;

function scoreSpecies(t: Traits, a: KeyAnswers): number | null {
  let got = 0;
  let max = 0;
  for (const q of QUESTIONS) {
    const value = answerValue(a, q.id);
    if (value == null || !isApplicable(q, a)) continue;
    max += q.weight;
    const ok = traitMatch(t, q.id, value);
    if (ok == null) continue; // признак не определён для вида — не штрафуем, но и не засчитываем
    got += ok ? q.weight : q.hard ? -2 * q.weight : -q.weight;
  }
  return max === 0 ? null : Math.max(0, got) / max;
}

export function runKey(db: SpeciesDb, traits: Record<string, Traits>, answers: KeyAnswers, limit = 10): KeyResult {
  const answered = answeredCount(answers);
  if (answered === 0) return { matches: [], dangerous: [], answered };

  const scored: KeyMatch[] = [];
  for (const s of db.all) {
    const t = traits[s.id];
    if (!t) continue;
    const m = scoreSpecies(t, answers);
    if (m == null) continue;
    const inSeason = answers.month == null ? null : isInSeason(s.season, answers.month);
    scored.push({ species: s, match: m, inSeason });
  }

  // Сезон влияет только на порядок: при равном совпадении вид в сезон — выше.
  const rank = (m: KeyMatch) => m.match - (m.inSeason === false ? 0.1 : 0);
  scored.sort((x, y) => rank(y) - rank(x) || x.species.nameRu.localeCompare(y.species.nameRu, 'ru'));

  const matches = scored.filter((m) => m.match >= KEY_MIN_MATCH).slice(0, limit);
  const dangerous = scored.filter((m) => isDangerous(m.species.edibility) && m.match >= KEY_DANGER_MATCH);
  return { matches, dangerous, answered };
}
