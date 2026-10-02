import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { checksFor, failedDangers, type ChecksData } from '../src/data/checks.ts';
import { isDangerous } from '../src/data/types.ts';
import { db } from './loadDb.ts';

const data = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'src', 'data', 'species', 'checks.json'), 'utf8'),
) as ChecksData;

test('проверки ссылаются на существующие виды и группы', () => {
  for (const [id, entries] of Object.entries(data.species)) {
    assert.ok(db.get(id), `checks.json: неизвестный вид ${id}`);
    for (const e of entries) {
      if (typeof e === 'string') assert.ok(data.groups[e.slice(1)], `${id}: нет группы ${e}`);
    }
  }
  for (const c of [...Object.values(data.groups).flat(), ...Object.values(data.species).flat()]) {
    if (typeof c === 'string') continue;
    assert.ok(c.must.length > 10 && c.ifNot.length > 10);
    for (const d of c.danger ?? []) {
      assert.ok(db.get(d), `неизвестный опасный вид ${d}`);
      assert.ok(isDangerous(db.get(d)!.edibility) || db.get(d)!.edibility === 'inedible', `${d} не опасен`);
    }
  }
});

test('у каждого съедобного вида есть проверки, у ядовитых — нет', () => {
  for (const s of db.all) {
    const checks = checksFor(s, data);
    if (s.edibility === 'edible' || s.edibility === 'conditionally_edible') {
      assert.ok(checks.length > 0, `${s.id}: нет проверочных признаков`);
    } else {
      assert.equal(checks.length, 0);
    }
  }
});

test('каждый опасный двойник съедобного вида упомянут в его проверках', () => {
  for (const s of db.all.filter((x) => x.edibility === 'edible' || x.edibility === 'conditionally_edible')) {
    const covered = new Set(checksFor(s, data).flatMap((c) => c.danger ?? []));
    for (const l of s.lookalikes) {
      const other = db.get(l.id)!;
      if (!isDangerous(other.edibility)) continue;
      assert.ok(covered.has(l.id), `${s.id}: проверки не предупреждают о опасном двойнике ${l.id}`);
    }
  }
});

test('шампиньон: жёлтое основание ножки указывает на желтокожий', () => {
  const checks = checksFor(db.get('agaricus-campestris')!, data);
  const i = checks.findIndex((c) => c.must.includes('основание ножки'));
  assert.ok(i >= 0);
  assert.ok(failedDangers(checks, { [i]: 'no' }).includes('agaricus-xanthodermus'));
  assert.deepEqual(failedDangers(checks, { [i]: 'yes' }), []);
});
