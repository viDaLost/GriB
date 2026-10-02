/**
 * Сведение нескольких ответов модели в один и учёт ответов пользователя.
 * Чистые функции без React Native — покрыты тестами.
 */
import {
  answerValue,
  isApplicable,
  QUESTION_BY_ID,
  QUESTIONS,
  traitMatch,
  type KeyAnswers,
  type QuestionId,
} from '../data/questions.ts';
import type { Traits } from '../data/traits.ts';
import { SERVICE_LABELS } from './decision.ts';

const EPS = 1e-9;

function normalize(values: number[]): number[] {
  const sum = values.reduce((a, b) => a + b, 0);
  return sum > 0 ? values.map((v) => v / sum) : values.map(() => 1 / values.length);
}

/**
 * Температурная калибровка: softmax(logits / T). Для вероятностей это p^(1/T) с нормировкой.
 * T > 1 делает модель скромнее, T < 1 — увереннее. T подбирается при обучении.
 */
export function applyTemperature(probs: ArrayLike<number>, temperature = 1): number[] {
  const arr = Array.from(probs);
  if (!(temperature > 0) || Math.abs(temperature - 1) < 1e-6) return normalize(arr);
  const logs = arr.map((p) => Math.log(Math.max(p, EPS)) / temperature);
  const max = Math.max(...logs);
  return normalize(logs.map((l) => Math.exp(l - max)));
}

/** Среднее нескольких распределений: снимки с разных сторон и варианты одного кадра. */
export function averageProbs(list: ArrayLike<number>[]): number[] {
  if (list.length === 0) throw new Error('Нет ни одного ответа модели');
  const n = list[0]!.length;
  const out = new Array<number>(n).fill(0);
  for (const p of list) {
    if (p.length !== n) throw new Error('Разная длина ответов модели');
    for (let i = 0; i < n; i++) out[i]! += (p[i] ?? 0) / list.length;
  }
  return normalize(out);
}

/** Во сколько раз снижается вероятность вида, если признак не совпал */
export const MISMATCH_FACTOR = 0.2;
/** …если не совпал «жёсткий» признак (форма, тип низа шляпки) */
export const HARD_MISMATCH_FACTOR = 0.03;

function traitFactor(t: Traits | undefined, answers: KeyAnswers): number {
  if (!t) return 1;
  let f = 1;
  for (const q of QUESTIONS) {
    const value = answerValue(answers, q.id);
    if (value == null || !isApplicable(q, answers)) continue;
    const ok = traitMatch(t, q.id, value);
    if (ok === false) f *= q.hard ? HARD_MISMATCH_FACTOR : MISMATCH_FACTOR;
  }
  return f;
}

/**
 * Уточнение ответа модели признаками, которые назвал пользователь.
 * Служебные классы не меняются: если ответы противоречат всем известным видам,
 * вероятность перетекает в «гриб не из справочника».
 */
export function fuseWithAnswers(
  probs: ArrayLike<number>,
  labels: string[],
  traits: Record<string, Traits>,
  answers: KeyAnswers,
): number[] {
  return normalize(
    labels.map((label, i) => {
      const p = probs[i] ?? 0;
      return SERVICE_LABELS.includes(label) ? p : p * traitFactor(traits[label], answers);
    }),
  );
}

/** Вопросы, которые лучше всего разделяют вероятные варианты; первым — про вольву, если среди них мухоморы. */
export function bestQuestions(
  probs: ArrayLike<number>,
  labels: string[],
  traits: Record<string, Traits>,
  answers: KeyAnswers,
  options: { limit?: number; dangerousIds?: Set<string> } = {},
): QuestionId[] {
  const { limit = 3, dangerousIds = new Set<string>() } = options;
  const candidates = labels
    .map((label, i) => ({ label, p: probs[i] ?? 0, t: traits[label] }))
    .filter((c) => c.t && c.p >= 0.02)
    .sort((a, b) => b.p - a.p)
    .slice(0, 12);
  if (candidates.length === 0) return [];

  // Форму и цвет видно на фото — спрашиваем то, что камера не видит.
  const pool = QUESTIONS.filter(
    (q) => q.id !== 'form' && q.id !== 'color' && answers[q.id] == null && isApplicable(q, answers),
  );

  const scored = pool.map((q) => {
    const mass = q.options.map((o) =>
      candidates.reduce((s, c) => s + (traitMatch(c.t!, q.id, o.value) === true ? c.p : 0), 0),
    );
    const total = mass.reduce((a, b) => a + b, 0);
    if (total <= 0) return { id: q.id, score: 0 };
    const entropy = -mass.reduce((s, m) => (m > 0 ? s + (m / total) * Math.log2(m / total) : s), 0);
    const coverage = total / candidates.reduce((s, c) => s + c.p, 0);
    return { id: q.id, score: entropy * Math.min(1, coverage) * q.weight };
  });

  const result = scored.filter((s) => s.score > 0.05).sort((a, b) => b.score - a.score).map((s) => s.id);

  // Безопасность: если среди вариантов есть опасный вид с вольвой — вопрос о ней всегда первый.
  const amanitaRisk = candidates.some((c) => c.t!.volva === true && dangerousIds.has(c.label) && c.p >= 0.05);
  if (amanitaRisk && answers.volva == null && isApplicable(QUESTION_BY_ID.volva, answers)) {
    return ['volva' as const, ...result.filter((id) => id !== 'volva')].slice(0, limit);
  }
  // A coloured latex is easily missed by the photo model. Ask even when milkcap
  // probabilities are low; otherwise an orange cap can remain an "opёnok".
  if (answers.milk === true && answers.milkColor == null && isApplicable(QUESTION_BY_ID.milkColor, answers)) {
    return ['milkColor' as const, ...result.filter((id) => id !== 'milkColor')].slice(0, limit);
  }
  const orangeCap = candidates.some((c) => c.t!.form === 'cap' && c.t!.colors.includes('orange'));
  if (orangeCap && answers.milk == null && answers.underside !== 'tubes' && isApplicable(QUESTION_BY_ID.milk, answers)) {
    return ['milk' as const, ...result.filter((id) => id !== 'milk')].slice(0, limit);
  }
  return result.slice(0, limit);
}

/** Different confident answers from different sides mean more evidence is needed. */
export function conflictingShots(outputs: ArrayLike<number>[]): boolean {
  const leaders = outputs.map((output) => {
    const values = Array.from(output);
    const p = Math.max(...values);
    return { i: values.indexOf(p), p };
  }).filter((l) => l.p >= 0.5);
  return new Set(leaders.map((l) => l.i)).size > 1;
}
