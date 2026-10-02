import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findToRecord, parseFinds, MY_FINDS_DATASET } from '../src/data/finds.ts';

test('сохранённые находки: повреждённые записи пропускаются', () => {
  const ok = { id: 'a', date: '2026-09-01T10:00:00Z', latitude: 55.7, longitude: 37.6, accuracy: 12 };
  const raw = JSON.stringify([ok, { id: 'b', date: 'x', latitude: 'n', longitude: 0 }, null, { id: 'c', date: 'x', latitude: 95, longitude: 0 }]);
  assert.deepEqual(parseFinds(raw), [ok]);
  assert.deepEqual(parseFinds('{не json'), []);
  assert.deepEqual(parseFinds(null), []);
});

test('находка показывается точкой своего слоя', () => {
  const r = findToRecord({ id: 'a', speciesId: 'boletus-edulis', date: '2026-09-01', latitude: 55, longitude: 37, accuracy: null });
  assert.equal(r.datasetId, MY_FINDS_DATASET);
  assert.equal(r.speciesId, 'boletus-edulis');
  assert.equal(r.uncertaintyMeters, null);
});
