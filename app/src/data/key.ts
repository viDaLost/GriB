import type { SpeciesDb } from './buildDatabase.ts';
import { isInSeason } from './season.ts';
import type { CapColor, CutColor, Form, Place, Substrate, Traits, Underside } from './traits.ts';
import { isDangerous, type Species } from './types.ts';

/** Ответы пользователя. Пропущенный вопрос («не знаю») не влияет на результат. */
export interface KeyAnswers {
  form?: Form;
  underside?: Underside;
  color?: CapColor;
  ring?: boolean;
  volva?: boolean;
  milk?: boolean;
  cut?: CutColor;
  substrate?: Substrate;
  place?: Exclude<Place, 'both'>;
  /** Текущий месяц 1–12: виды не в сезон опускаются ниже, но не исчезают */
  month?: number;
}

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

/** Вес признака: форма и низ шляпки почти однозначно разделяют группы грибов. */
const WEIGHTS = {
  form: 4,
  underside: 4,
  color: 2,
  ring: 2,
  volva: 3,
  milk: 2,
  cut: 2,
  substrate: 2,
  place: 1,
} as const;

/** С какого совпадения вид показывается */
export const KEY_MIN_MATCH = 0.5;
/** С какого совпадения ядовитый вид попадает в блок предупреждений */
export const KEY_DANGER_MATCH = 0.6;

function scoreSpecies(t: Traits, a: KeyAnswers): number | null {
  let got = 0;
  let max = 0;
  const check = (weight: number, answered: boolean, trait: unknown, ok: boolean, hard = false) => {
    if (!answered) return;
    max += weight;
    if (trait == null) return; // признак не определён для вида — не штрафуем, но и не засчитываем
    got += ok ? weight : hard ? -2 * weight : -weight;
  };

  check(WEIGHTS.form, a.form != null, t.form, t.form === a.form, true);
  if (a.form == null || a.form === 'cap') {
    check(WEIGHTS.underside, a.underside != null, t.underside, t.underside === a.underside, true);
  }
  check(WEIGHTS.color, a.color != null, t.colors, a.color != null && t.colors.includes(a.color));
  check(WEIGHTS.ring, a.ring != null, t.ring, t.ring === a.ring);
  check(WEIGHTS.volva, a.volva != null, t.volva, t.volva === a.volva);
  check(WEIGHTS.milk, a.milk != null, t.milk, t.milk === a.milk);
  check(WEIGHTS.cut, a.cut != null, t.cut, a.cut != null && (t.cut ?? []).includes(a.cut));
  check(WEIGHTS.substrate, a.substrate != null, t.substrate, t.substrate === a.substrate);
  check(
    WEIGHTS.place,
    a.place != null,
    t.place,
    t.place === 'both' || t.place === a.place,
  );

  return max === 0 ? null : Math.max(0, got) / max;
}

export function runKey(db: SpeciesDb, traits: Record<string, Traits>, answers: KeyAnswers, limit = 10): KeyResult {
  const scored: KeyMatch[] = [];
  let answered = 0;
  for (const s of db.all) {
    const t = traits[s.id];
    if (!t) continue;
    const m = scoreSpecies(t, answers);
    if (m == null) continue;
    const inSeason = answers.month == null ? null : isInSeason(s.season, answers.month);
    scored.push({ species: s, match: m, inSeason });
  }
  answered = (Object.keys(answers) as (keyof KeyAnswers)[]).filter(
    (k) => k !== 'month' && answers[k] != null,
  ).length;
  if (answered === 0) return { matches: [], dangerous: [], answered };

  // Сезон влияет только на порядок: при равном совпадении вид в сезон — выше.
  const rank = (m: KeyMatch) => m.match - (m.inSeason === false ? 0.1 : 0);
  scored.sort((x, y) => rank(y) - rank(x) || x.species.nameRu.localeCompare(y.species.nameRu, 'ru'));

  const matches = scored.filter((m) => m.match >= KEY_MIN_MATCH).slice(0, limit);
  const dangerous = scored.filter((m) => isDangerous(m.species.edibility) && m.match >= KEY_DANGER_MATCH);
  return { matches, dangerous, answered };
}
