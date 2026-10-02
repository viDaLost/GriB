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
