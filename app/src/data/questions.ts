/**
 * Вопросы о признаках гриба — общие для определителя и для уточнения после фото.
 * Чистый модуль без React Native.
 */
import {
  COLOR_LABEL,
  CUT_LABEL,
  FORM_LABEL,
  PLACE_LABEL,
  SUBSTRATE_LABEL,
  UNDERSIDE_LABEL,
  type CapColor,
  type CutColor,
  type Form,
  type MilkColor,
  type Place,
  type Substrate,
  type Traits,
  type Underside,
} from './traits.ts';

/** Ответы пользователя. Пропущенный вопрос («не знаю») не влияет на результат. */
export interface KeyAnswers {
  form?: Form;
  underside?: Underside;
  color?: CapColor;
  ring?: boolean;
  volva?: boolean;
  milk?: boolean;
  milkColor?: MilkColor;
  cut?: CutColor;
  substrate?: Substrate;
  place?: Exclude<Place, 'both'>;
  /** Текущий месяц 1–12: виды не в сезон опускаются ниже, но не исчезают */
  month?: number;
}

export type QuestionId = Exclude<keyof KeyAnswers, 'month'>;

export interface Question {
  id: QuestionId;
  title: string;
  hint?: string;
  /** Насколько сильно признак разделяет виды */
  weight: number;
  /** Несовпадение почти исключает вид (форма, тип низа шляпки) */
  hard?: boolean;
  /** Вопрос имеет смысл только для грибов со шляпкой на ножке */
  capOnly?: boolean;
  options: { value: string; label: string }[];
}

const opts = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));
const YES_NO = [
  { value: 'yes', label: 'Есть' },
  { value: 'no', label: 'Нет' },
];

export const QUESTIONS: Question[] = [
  { id: 'form', title: 'Как выглядит гриб?', weight: 4, hard: true, options: opts(FORM_LABEL) },
  { id: 'underside', title: 'Что под шляпкой?', weight: 4, hard: true, capOnly: true, options: opts(UNDERSIDE_LABEL) },
  { id: 'color', title: 'Цвет шляпки', weight: 2, options: opts(COLOR_LABEL) },
  { id: 'ring', title: 'Кольцо («юбочка») на ножке', weight: 2, capOnly: true, options: YES_NO },
  {
    id: 'volva',
    title: 'Мешочек (вольва) или клубень с ободком у основания ножки',
    hint: 'Выкопайте гриб целиком — у самых опасных мухоморов вольва прячется в земле.',
    weight: 3,
    capOnly: true,
    options: YES_NO,
  },
  { id: 'milk', title: 'Есть ли млечный сок на изломе?', hint: 'Посмотрите на свежий излом пластинок: выступают ли капли? Не пробуйте гриб на вкус.', weight: 3, capOnly: true, options: YES_NO },
  { id: 'milkColor', title: 'Какого цвета свежий млечный сок?', hint: 'Цвет сразу после излома. У рыжиков из справочника сок оранжевый; позже он может менять цвет.', weight: 4, capOnly: true, options: [
    { value: 'orange', label: 'Оранжевый' }, { value: 'red', label: 'Красный' },
    { value: 'white', label: 'Белый' }, { value: 'clear', label: 'Бесцветный' },
  ] },
  { id: 'cut', title: 'Мякоть на срезе', weight: 2, options: opts(CUT_LABEL) },
  { id: 'substrate', title: 'Где растёт?', weight: 2, options: opts(SUBSTRATE_LABEL) },
  { id: 'place', title: 'Место', weight: 1, options: opts(PLACE_LABEL) },
];

export const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q])) as Record<
  QuestionId,
  Question
>;

const BOOL_IDS = new Set<QuestionId>(['ring', 'volva', 'milk']);

/** Ответ в виде строки варианта ('yes'/'no' для да/нет). */
export function answerValue(a: KeyAnswers, id: QuestionId): string | undefined {
  const v = a[id];
  if (v == null) return undefined;
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

/** Новый набор ответов; повторный выбор того же варианта снимает ответ. */
export function toggleAnswer(a: KeyAnswers, id: QuestionId, value: string): KeyAnswers {
  const next: KeyAnswers = { ...a };
  if (answerValue(a, id) === value) {
    delete next[id];
  } else {
    (next as Record<string, unknown>)[id] = BOOL_IDS.has(id) ? value === 'yes' : value;
  }
  if (id === 'milk' || id === 'form') {
    if (next.milk !== true || (next.form != null && next.form !== 'cap')) delete next.milkColor;
  }
  return next;
}

export function isApplicable(q: Question, a: KeyAnswers): boolean {
  if (q.id === 'milkColor' && a.milk !== true) return false;
  return !q.capOnly || a.form == null || a.form === 'cap';
}

export function answeredCount(a: KeyAnswers): number {
  return QUESTIONS.filter((q) => a[q.id] != null && isApplicable(q, a)).length;
}

/**
 * Совпадает ли признак вида с вариантом ответа.
 * null — для вида признак не определён или не применим: не штрафуем и не засчитываем.
 */
export function traitMatch(t: Traits, id: QuestionId, value: string): boolean | null {
  switch (id) {
    case 'form':
      return t.form === value;
    case 'underside':
      return t.form !== 'cap' || t.underside == null ? null : t.underside === value;
    case 'color':
      return t.colors.includes(value as CapColor);
    case 'ring':
    case 'volva':
    case 'milk':
      return t[id] == null ? null : t[id] === (value === 'yes');
    case 'cut':
      return t.cut == null ? null : t.cut.includes(value as CutColor);
    case 'milkColor':
      return t.milk === false ? false : t.milkColor == null ? null : t.milkColor.includes(value as MilkColor);
    case 'substrate':
      return t.substrate == null ? null : t.substrate === value;
    case 'place':
      return t.place === 'both' || t.place === value;
  }
}
