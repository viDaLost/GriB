import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Traits } from '../src/data/traits.ts';
import { isDangerous } from '../src/data/types.ts';
import { identify, NOT_MUSHROOM, OTHER_FUNGUS } from '../src/ml/decision.ts';
import { applyTemperature, averageProbs, bestQuestions, fuseWithAnswers } from '../src/ml/ensemble.ts';
import { db } from './loadDb.ts';

const traits = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'src', 'data', 'species', 'traits.json'), 'utf8'),
) as Record<string, Traits>;
const dangerousIds = new Set(db.all.filter((s) => isDangerous(s.edibility)).map((s) => s.id));

const LABELS = [
  'amanita-phalloides',
  'russula-virescens',
  'tricholoma-equestre',
  'boletus-edulis',
  'tylopilus-felleus',
  'lactarius-deliciosus',
  NOT_MUSHROOM,
  OTHER_FUNGUS,
];
const probs = (m: Record<string, number>) => {
  const rest = (1 - Object.values(m).reduce((a, b) => a + b, 0)) / (LABELS.length - Object.keys(m).length);
  return LABELS.map((l) => m[l] ?? rest);
};
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

test('температура: T=1 не меняет, T>1 смягчает, T<1 обостряет', () => {
  const p = [0.7, 0.2, 0.1];
  assert.deepEqual(applyTemperature(p, 1).map((x) => +x.toFixed(6)), p);
  const soft = applyTemperature(p, 2);
  const sharp = applyTemperature(p, 0.5);
  assert.ok(soft[0]! < 0.7 && sharp[0]! > 0.7);
  assert.ok(Math.abs(sum(soft) - 1) < 1e-9 && Math.abs(sum(sharp) - 1) < 1e-9);
  assert.ok(soft[0]! > soft[1]! && soft[1]! > soft[2]!, 'порядок сохраняется');
});

test('усреднение снимков', () => {
  const avg = averageProbs([
    [1, 0, 0],
    [0, 1, 0],
  ]);
  assert.deepEqual(avg, [0.5, 0.5, 0]);
  assert.throws(() => averageProbs([]));
  assert.throws(() => averageProbs([[1], [0.5, 0.5]]));
});

test('ответы уточняют: губка вместо пластинок отсекает пластинчатые', () => {
  const p = probs({ 'boletus-edulis': 0.4, 'russula-virescens': 0.4 });
  const f = fuseWithAnswers(p, LABELS, traits, { underside: 'tubes' });
  const i = (id: string) => LABELS.indexOf(id);
  assert.ok(f[i('boletus-edulis')]! > 0.7);
  assert.ok(f[i('tylopilus-felleus')]! > f[i('russula-virescens')]!, 'трубчатый двойник выше пластинчатого');
  assert.ok(f[i('russula-virescens')]! < 0.05);
  assert.ok(Math.abs(sum(f) - 1) < 1e-9);
});

test('ответы, противоречащие всем видам, уходят в «гриб не из справочника»', () => {
  const p = probs({ 'boletus-edulis': 0.9 });
  const f = fuseWithAnswers(p, LABELS, traits, { underside: 'gills', milk: true, color: 'violet' });
  assert.ok(f[LABELS.indexOf(OTHER_FUNGUS)]! > p[LABELS.indexOf(OTHER_FUNGUS)]!);
});

test('ответ «вольвы нет» не прячет бледную поганку, найденную по фото', () => {
  const photo = probs({ 'russula-virescens': 0.6, 'amanita-phalloides': 0.3 });
  const fused = fuseWithAnswers(photo, LABELS, traits, { volva: false, ring: false });
  const r = identify(fused, LABELS, db, { safetyOutput: photo });
  assert.equal(r.candidates[0]!.species.id, 'russula-virescens');
  assert.equal(r.alertLevel, 'deadly');
  assert.ok(r.dangerousCandidates.some((c) => c.species.id === 'amanita-phalloides'));
  // Без проверки по фото предупреждение пропало бы — именно поэтому safetyOutput обязателен.
  const unsafe = identify(fused, LABELS, db);
  assert.ok(unsafe.dangerousCandidates.every((c) => c.species.id !== 'amanita-phalloides'));
});

test('лучшие вопросы: при подозрении на мухомор первым спрашиваем вольву', () => {
  const p = probs({ 'russula-virescens': 0.5, 'amanita-phalloides': 0.3, 'tricholoma-equestre': 0.1 });
  const q = bestQuestions(p, LABELS, traits, {}, { dangerousIds });
  assert.equal(q[0], 'volva');
  assert.ok(q.length <= 3 && !q.includes('form') && !q.includes('color'));
});

test('лучшие вопросы не повторяют уже отвеченные', () => {
  const p = probs({ 'boletus-edulis': 0.4, 'lactarius-deliciosus': 0.4 });
  const q = bestQuestions(p, LABELS, traits, { underside: 'tubes' }, { dangerousIds });
  assert.ok(!q.includes('underside'));
});

test('один уверенный вариант — вопросы не нужны', () => {
  const p = LABELS.map((l) => (l === 'boletus-edulis' ? 1 : 0));
  assert.deepEqual(bestQuestions(p, LABELS, traits, {}), []);
});
