import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatSeason, isInSeason } from '../src/data/season.ts';
import { normalize, searchSpecies } from '../src/data/search.ts';
import { db } from './loadDb.ts';

test('поиск по народному названию и без «ё»', () => {
  const r = searchSpecies(db.all, { query: 'подберезовик' });
  assert.equal(r[0]!.id, 'leccinum-scabrum');
  assert.ok(searchSpecies(db.all, { query: 'боровик' }).some((s) => s.id === 'boletus-edulis'));
  assert.ok(searchSpecies(db.all, { query: 'Чернушка' }).some((s) => s.id === 'lactarius-necator'));
});

test('поиск по латыни', () => {
  const r = searchSpecies(db.all, { query: 'amanita phall' });
  assert.equal(r[0]!.id, 'amanita-phalloides');
});

test('фильтры по съедобности и гименофору', () => {
  const deadly = searchSpecies(db.all, { edibility: ['deadly'] });
  assert.ok(deadly.length >= 5);
  assert.ok(deadly.every((s) => s.edibility === 'deadly'));
  const tubes = searchSpecies(db.all, { hymenophore: 'tubes' });
  assert.ok(tubes.every((s) => s.hymenophore === 'tubes'));
});

test('совпадения с начала слова идут первыми', () => {
  const r = searchSpecies(db.all, { query: 'опёнок' });
  assert.ok(r.slice(0, 4).every((s) => normalize(s.nameRu).includes('опенок')));
});

test('сезон через Новый год', () => {
  assert.ok(isInSeason([9, 4], 1));
  assert.ok(isInSeason([9, 4], 10));
  assert.ok(!isInSeason([9, 4], 7));
  assert.ok(isInSeason([6, 10], 6));
  assert.ok(!isInSeason([6, 10], 11));
  assert.equal(formatSeason([1, 12]), 'круглый год');
  assert.equal(formatSeason([6, 10]), 'июнь — октябрь');
});
