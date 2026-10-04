import assert from 'node:assert/strict';
import { test } from 'node:test';
import { identify, NOT_MUSHROOM, OTHER_FUNGUS, toProbabilities } from '../src/ml/decision.ts';
import { db } from './loadDb.ts';

const LABELS = [
  'boletus-edulis',
  'leccinum-scabrum',
  'russula-virescens',
  'amanita-phalloides',
  'gyromitra-esculenta',
  'morchella-esculenta',
  'amanita-muscaria',
  'tylopilus-felleus',
  NOT_MUSHROOM,
  OTHER_FUNGUS,
];

/** Распределение: заданные вероятности, остаток — поровну между прочими классами. */
function output(probs: Record<string, number>): number[] {
  const rest = 1 - Object.values(probs).reduce((a, b) => a + b, 0);
  const others = LABELS.filter((l) => !(l in probs)).length;
  return LABELS.map((l) => probs[l] ?? rest / others);
}

test('уверенный съедобный: «похоже на», без слов «можно есть»', () => {
  const r = identify(output({ 'boletus-edulis': 0.93 }), LABELS, db, { month: 8 });
  assert.equal(r.verdict, 'confident');
  assert.equal(r.candidates[0]!.species.id, 'boletus-edulis');
  assert.equal(r.alertLevel, 'caution');
  assert.match(r.headline, /^Похоже на: Белый гриб/);
  assert.match(r.advice, /может ошибаться/);
  assert.doesNotMatch(r.advice + r.headline, /можно есть|безопас/i);
});

test('смертельно ядовитый вид с небольшой вероятностью всё равно поднимает тревогу', () => {
  const r = identify(
    output({ 'russula-virescens': 0.86, 'amanita-phalloides': 0.07 }),
    LABELS,
    db,
    { month: 8 },
  );
  assert.equal(r.candidates[0]!.species.id, 'russula-virescens');
  assert.equal(r.alertLevel, 'deadly');
  assert.ok(r.dangerousCandidates.some((c) => c.species.id === 'amanita-phalloides'));
  assert.match(r.advice, /смертельно ядовитый/);
});

test('сезон меняет порядок, но не прячет опасный гриб', () => {
  // Август: белый в сезон, строчок (апрель–май) — нет.
  const r = identify(
    output({ 'boletus-edulis': 0.45, 'gyromitra-esculenta': 0.45 }),
    LABELS,
    db,
    { month: 8 },
  );
  assert.equal(r.candidates[0]!.species.id, 'boletus-edulis');
  assert.equal(r.candidates[1]!.inSeason, false);
  assert.equal(r.alertLevel, 'deadly');
  assert.ok(r.dangerousCandidates.some((c) => c.species.id === 'gyromitra-esculenta'));
});

test('сезон не превращает слабое фото в уверенное определение', () => {
  const r = identify(output({ 'boletus-edulis': 0.55, 'gyromitra-esculenta': 0.4 }), LABELS, db, { month: 8 });
  assert.ok(r.candidates[0]!.probability > 0.7);
  assert.ok(Math.abs(r.candidates[0]!.photoProbability - 0.55) < 1e-12);
  assert.equal(r.verdict, 'similar');
  assert.equal(r.alertLevel, 'deadly');
});

test('исключение вероятности «не гриб» не повышает уверенность', () => {
  const r = identify(output({ 'boletus-edulis': 0.49, [NOT_MUSHROOM]: 0.49 }), LABELS, db);
  assert.ok(r.candidates[0]!.probability > 0.9);
  assert.equal(r.verdict, 'similar');
});

test('ответы о признаках не заменяют слабые доказательства на фото', () => {
  const r = identify(output({ 'boletus-edulis': 0.97 }), LABELS, db, {
    safetyOutput: output({ 'boletus-edulis': 0.45, 'leccinum-scabrum': 0.5 }),
  });
  assert.equal(r.verdict, 'similar');
});

test('валидационные правила могут ужесточить уверенный ответ', () => {
  const photo = output({ 'boletus-edulis': 0.8 });
  assert.equal(identify(photo, LABELS, db).verdict, 'confident');
  assert.equal(identify(photo, LABELS, db, { policy: { confident: 0.85, allowConfident: true } }).verdict, 'similar');
  assert.equal(identify(photo, LABELS, db, { policy: { confident: 0.7, allowConfident: false } }).verdict, 'similar');
  assert.throws(() => identify(photo, LABELS, db, { policy: { confident: 0.6, allowConfident: true } }));
});

test('опасный двойник лучшего варианта показывается из справочника', () => {
  const r = identify(output({ 'russula-virescens': 0.95 }), LABELS, db, { month: 8 });
  assert.ok(r.dangerousLookalikes.some((s) => s.id === 'amanita-phalloides'));
});

test('ровное распределение — «не определено»', () => {
  const flat = LABELS.map(() => 1 / LABELS.length);
  const r = identify(flat, LABELS, db);
  assert.equal(r.verdict, 'unknown');
  assert.equal(r.headline, 'Не определено');
  assert.equal(r.candidates.length, 3);
});

test('несколько близких вариантов — «возможно»', () => {
  const r = identify(output({ 'boletus-edulis': 0.5, 'leccinum-scabrum': 0.4 }), LABELS, db);
  assert.equal(r.verdict, 'similar');
  assert.match(r.headline, /^Возможно:/);
});

test('класс «не гриб»', () => {
  const r = identify(output({ [NOT_MUSHROOM]: 0.8 }), LABELS, db);
  assert.equal(r.verdict, 'not_mushroom');
  assert.equal(r.candidates.length, 0);
});

test('гриб не из справочника не притягивается к ближайшему виду', () => {
  const r = identify(output({ [OTHER_FUNGUS]: 0.75, 'boletus-edulis': 0.15 }), LABELS, db);
  assert.equal(r.verdict, 'unknown');
  assert.equal(r.headline, 'Похоже на гриб не из справочника');
  assert.ok(r.candidates[0]!.probability < 0.3);
});

test('гриб не из справочника не скрывает опасный вид', () => {
  const r = identify(output({ [OTHER_FUNGUS]: 0.6, 'amanita-phalloides': 0.3 }), LABELS, db);
  assert.equal(r.alertLevel, 'deadly');
});

test('логиты вместо вероятностей нормализуются', () => {
  const p = toProbabilities([2, 1, 0.1]);
  assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(p[0]! > p[1]! && p[1]! > p[2]!);
  const logits = LABELS.map((l) => (l === 'amanita-muscaria' ? 8 : 0));
  const r = identify(logits, LABELS, db);
  assert.equal(r.candidates[0]!.species.id, 'amanita-muscaria');
  assert.equal(r.alertLevel, 'poisonous');
});

test('несовпадение числа классов и меток — ошибка', () => {
  assert.throws(() => identify([0.5, 0.5], LABELS, db));
});

test('добавление двух снимков не прячет опасный вид с первого', () => {
  const labels = ['russula-virescens', 'amanita-phalloides', OTHER_FUNGUS];
  const shots = [[0.88, 0.1, 0.02], [0.98, 0, 0.02], [0.98, 0, 0.02]];
  const avg = [2.84 / 3, 0.1 / 3, 0.02];
  const r = identify(avg, labels, db, { safetyOutput: avg, safetyOutputs: shots });
  assert.equal(r.alertLevel, 'deadly');
  assert.ok(r.dangerousCandidates[0]!.rawProbability >= 0.1);
});

test('противоречивые снимки не дают уверенного определения', () => {
  const r = identify(output({ 'boletus-edulis': 0.95 }), LABELS, db, { conflictingEvidence: true });
  assert.equal(r.verdict, 'unknown');
  assert.throws(() => toProbabilities([NaN, 0.5]));
});

test('пустые новые кадры не стирают предупреждение с первого снимка', () => {
  const labels = ['amanita-phalloides', 'russula-virescens', NOT_MUSHROOM];
  const shots = [[0.2, 0.7, 0.1], [0, 0, 1], [0, 0, 1]];
  const r = identify([0.2 / 3, 0.7 / 3, 2.1 / 3], labels, db, { safetyOutputs: shots });
  assert.equal(r.alertLevel, 'deadly');
  assert.equal(r.verdict, 'unknown');
});
