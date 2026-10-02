import { isInSeason } from '../data/season.ts';
import type { SpeciesDb } from '../data/buildDatabase.ts';
import { EDIBILITY_LABEL, isDangerous, type Species } from '../data/types.ts';

/** Служебный класс модели: «в кадре не гриб» (листья, трава, рука и т.п.). */
export const NOT_MUSHROOM = '__not_mushroom__';
/** Служебный класс модели: гриб, которого нет в справочнике. */
export const OTHER_FUNGUS = '__other_fungus__';
export const SERVICE_LABELS = [NOT_MUSHROOM, OTHER_FUNGUS];

export const THRESHOLDS = {
  /** Лучший вариант не ниже — «похоже на» один вид */
  confident: 0.7,
  /** Лучший вариант не ниже — «возможно», показываем несколько */
  similar: 0.3,
  /** Опасный вид с такой (несезонной) вероятностью показываем всегда */
  dangerMin: 0.05,
  /** Вероятность класса «не гриб», начиная с которой считаем, что гриба в кадре нет */
  notMushroom: 0.5,
  /** Множитель для видов не в сезон. Влияет только на порядок, не на предупреждения. */
  outOfSeasonWeight: 0.35,
} as const;

export type Verdict = 'confident' | 'similar' | 'unknown' | 'not_mushroom';

/**
 * Уровень предупреждения. «Безопасного» уровня нет намеренно:
 * распознавание по фото никогда не даёт права есть гриб.
 */
export type AlertLevel = 'deadly' | 'poisonous' | 'caution';

export interface Candidate {
  species: Species;
  /** Вероятность с учётом сезона — по ней сортируем и показываем проценты */
  probability: number;
  /** Вероятность модели без поправок (среди грибов) — по ней ловим опасные виды */
  rawProbability: number;
  /** null — месяц неизвестен */
  inSeason: boolean | null;
}

export interface Identification {
  verdict: Verdict;
  alertLevel: AlertLevel;
  headline: string;
  advice: string;
  /** Лучшие варианты по убыванию вероятности */
  candidates: Candidate[];
  /** Опасные виды среди вероятных — даже если они не в списке лучших */
  dangerousCandidates: Candidate[];
  /** Опасные двойники лучшего варианта из справочника */
  dangerousLookalikes: Species[];
}

export interface DecisionOptions {
  /** Текущий месяц 1–12 — для поправки на сезон */
  month?: number;
  topK?: number;
  /**
   * Ответ модели только по фото, без уточнений пользователя. Опасные виды ищутся
   * и в нём: ошибочный ответ («вольвы нет» — а она осталась в земле) не должен
   * скрыть бледную поганку.
   */
  safetyOutput?: ArrayLike<number>;
  /** Check every original shot: averaging must not hide a dangerous prediction. */
  safetyOutputs?: ArrayLike<number>[];
  conflictingEvidence?: boolean;
}

/** Вероятность каждого вида при условии, что в кадре гриб. */
function mushroomConditional(probs: number[], labels: string[]): Map<string, number> {
  let mass = 0;
  labels.forEach((l, i) => {
    if (l !== NOT_MUSHROOM) mass += probs[i] ?? 0;
  });
  const out = new Map<string, number>();
  labels.forEach((l, i) => {
    if (l !== NOT_MUSHROOM && l !== OTHER_FUNGUS) out.set(l, (probs[i] ?? 0) / (mass || 1));
  });
  return out;
}

/** Выход модели должен быть softmax; если пришли логиты — нормализуем сами. */
export function toProbabilities(values: ArrayLike<number>): number[] {
  const arr = Array.from(values);
  if (arr.length === 0 || arr.some((v) => !Number.isFinite(v))) throw new Error('Некорректный ответ модели');
  const sum = arr.reduce((a, b) => a + b, 0);
  const looksLikeProbs = arr.every((v) => v >= 0 && v <= 1) && Math.abs(sum - 1) < 0.02;
  if (looksLikeProbs) return arr.map((v) => v / sum);
  const max = Math.max(...arr);
  const exps = arr.map((v) => Math.exp(v - max));
  const expSum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / expSum);
}

function names(list: Candidate[]): string {
  return list.map((c) => c.species.nameRu).join(', ');
}

export function identify(
  output: ArrayLike<number>,
  labels: string[],
  db: SpeciesDb,
  options: DecisionOptions = {},
): Identification {
  if (output.length !== labels.length) {
    throw new Error(`Модель вернула ${output.length} классов, а меток ${labels.length}`);
  }
  const { month, topK = 3, safetyOutput, safetyOutputs = [], conflictingEvidence = false } = options;
  const probs = toProbabilities(output);
  if (safetyOutput && safetyOutput.length !== labels.length) {
    throw new Error('Ответ модели для проверки безопасности другой длины');
  }
  const safety = new Map<string, number>();
  for (const shot of [...(safetyOutput ? [safetyOutput] : []), ...safetyOutputs]) {
    if (shot.length !== labels.length) throw new Error('Ответ модели для проверки безопасности другой длины');
    const p = toProbabilities(shot);
    // Do not amplify mushroom noise on a clearly non-mushroom frame.
    const notIndex = labels.indexOf(NOT_MUSHROOM);
    if (notIndex >= 0 && p[notIndex]! >= THRESHOLDS.notMushroom) continue;
    for (const [id, value] of mushroomConditional(p, labels)) safety.set(id, Math.max(value, safety.get(id) ?? 0));
  }

  let notMushroom = 0;
  let otherFungus = 0;
  const raw: { species: Species; p: number }[] = [];
  labels.forEach((label, i) => {
    const p = probs[i] ?? 0;
    if (label === NOT_MUSHROOM) {
      notMushroom += p;
      return;
    }
    if (label === OTHER_FUNGUS) {
      otherFungus += p;
      return;
    }
    const species = db.get(label);
    if (species) raw.push({ species, p });
  });

  const safetyDanger = [...safety].some(([id, p]) => {
    const species = db.get(id);
    return species && isDangerous(species.edibility) && p >= THRESHOLDS.dangerMin;
  });
  if ((notMushroom >= THRESHOLDS.notMushroom && !safetyDanger) || raw.length === 0) {
    return {
      verdict: 'not_mushroom',
      alertLevel: 'caution',
      headline: 'Гриб в кадре не найден',
      advice: 'Наведите камеру так, чтобы гриб занимал большую часть кадра, и сфотографируйте его сбоку, чтобы были видны шляпка, низ шляпки и ножка.',
      candidates: [],
      dangerousCandidates: [],
      dangerousLookalikes: [],
    };
  }

  // Вероятности при условии, что в кадре гриб. «Гриб не из справочника» остаётся
  // в знаменателе — тогда незнакомый гриб не притягивается к ближайшему виду из базы.
  const mushroomMass = raw.reduce((a, r) => a + r.p, otherFungus) || 1;
  const otherShare = otherFungus / mushroomMass;
  const weighted = raw.map(({ species, p }) => {
    const inSeason = month == null ? null : isInSeason(species.season, month);
    const w = inSeason === false ? THRESHOLDS.outOfSeasonWeight : 1;
    return { species, rawProbability: p / mushroomMass, w: (p / mushroomMass) * w, inSeason };
  });
  const weightedMass = weighted.reduce((a, c) => a + c.w, otherShare) || 1;
  const all: Candidate[] = weighted
    .map((c) => ({
      species: c.species,
      rawProbability: Math.max(c.rawProbability, safety.get(c.species.id) ?? 0),
      probability: c.w / weightedMass,
      inSeason: c.inSeason,
    }))
    .sort((a, b) => b.probability - a.probability);

  const candidates = all.slice(0, topK);
  const top = candidates[0]!;

  // Опасные виды ищем по вероятности БЕЗ сезонной поправки:
  // сезон в разных регионах сдвигается, и прятать из-за него ядовитый гриб нельзя.
  const dangerousCandidates = all
    .filter(
      (c) =>
        isDangerous(c.species.edibility) &&
        (c.rawProbability >= THRESHOLDS.dangerMin || candidates.includes(c)),
    )
    .sort((a, b) => b.rawProbability - a.rawProbability);

  const flagged = new Set(dangerousCandidates.map((c) => c.species.id));
  const dangerousLookalikes = top.species.lookalikes
    .map((l) => db.get(l.id))
    .filter((s): s is Species => s != null && isDangerous(s.edibility) && !flagged.has(s.id));

  // Answers can radically sharpen a weak photograph; this does not turn the
  // underlying image evidence into a confident identification.
  const photoTop = safetyOutput ? mushroomConditional(toProbabilities(safetyOutput), labels).get(top.species.id) ?? 0 : top.probability;
  const confidentPhoto = !safetyOutput || photoTop >= THRESHOLDS.similar;
  const margin = top.probability - (candidates[1]?.probability ?? 0);
  const verdict: Verdict = conflictingEvidence || notMushroom >= THRESHOLDS.notMushroom ? 'unknown' :
    top.probability >= THRESHOLDS.confident && margin >= 0.15 && confidentPhoto
      ? 'confident'
      : top.probability >= THRESHOLDS.similar
        ? 'similar'
        : 'unknown';

  const deadly = dangerousCandidates.filter((c) => c.species.edibility === 'deadly');
  const alertLevel: AlertLevel =
    deadly.length > 0 ? 'deadly' : dangerousCandidates.length > 0 ? 'poisonous' : 'caution';

  const unlisted = verdict === 'unknown' && otherShare / weightedMass > top.probability;
  const headline =
    verdict === 'confident'
      ? `Похоже на: ${top.species.nameRu}`
      : verdict === 'similar'
        ? `Возможно: ${top.species.nameRu}`
        : unlisted
          ? 'Похоже на гриб не из справочника'
          : 'Не определено';

  let advice: string;
  if (deadly.length > 0) {
    advice = `По фото нельзя исключить смертельно ядовитый вид: ${names(deadly)}. Это не подтверждение вида. Не употребляйте гриб в пищу и не кладите в общую корзину.`;
  } else if (dangerousCandidates.length > 0) {
    advice = `Возможно, это ядовитый гриб: ${names(dangerousCandidates)}. Не употребляйте в пищу.`;
  } else if (verdict === 'unknown') {
    advice = conflictingEvidence ? 'Снимки дают противоречивые результаты. Проверьте, что на всех фото один гриб, и уточните его признаки. Не употребляйте его в пищу.' : unlisted
      ? 'Скорее всего, этого вида нет в справочнике приложения. Не употребляйте гриб, пока его не проверит опытный грибник.'
      : 'Уверенно определить не удалось. Не употребляйте гриб, пока его не проверит опытный грибник.';
  } else {
    const kind = EDIBILITY_LABEL[top.species.edibility].toLowerCase();
    advice =
      verdict === 'confident'
        ? `По фото похоже на вид из категории «${kind}». Распознавание может ошибаться — сверьте все признаки по карточке и проверьте опасных двойников.`
        : 'Похоже на несколько видов. Сравните признаки по карточкам и не собирайте гриб, если сомневаетесь.';
  }

  return {
    verdict,
    alertLevel,
    headline,
    advice,
    candidates,
    dangerousCandidates,
    dangerousLookalikes,
  };
}
