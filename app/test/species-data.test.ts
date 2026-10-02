import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { DANGER_RANK, EDIBILITY_LABEL, HYMENOPHORE_LABEL, isDangerous } from '../src/data/types.ts';
import { SERVICE_LABELS } from '../src/ml/decision.ts';
import { db, pairs, records } from './loadDb.ts';

test('id уникальны и совпадают с латинским названием', () => {
  const seen = new Set<string>();
  for (const r of records) {
    assert.ok(!seen.has(r.id), `повтор id ${r.id}`);
    seen.add(r.id);
    const expected = r.latin.toLowerCase().replace(/\s+/g, '-');
    assert.equal(r.id, expected, `id ${r.id} должен быть ${expected}`);
  }
});

test('все поля заполнены и корректны', () => {
  for (const r of records) {
    const where = `вид ${r.id}`;
    for (const key of ['nameRu', 'latin', 'family', 'cap', 'underside', 'stem', 'flesh', 'habitat', 'range'] as const) {
      assert.ok(typeof r[key] === 'string' && r[key].trim().length > 0, `${where}: пустое поле ${key}`);
    }
    assert.ok(r.edibility in EDIBILITY_LABEL, `${where}: неизвестная съедобность ${r.edibility}`);
    assert.ok(r.hymenophore in HYMENOPHORE_LABEL, `${where}: неизвестный гименофор ${r.hymenophore}`);
    assert.ok(Array.isArray(r.altNamesRu), `${where}: altNamesRu должен быть массивом`);
    assert.ok(r.keyFeatures.length >= 2, `${where}: нужно хотя бы 2 ключевых признака`);
    assert.equal(r.season.length, 2, `${where}: сезон — пара месяцев`);
    for (const m of r.season) {
      assert.ok(Number.isInteger(m) && m >= 1 && m <= 12, `${where}: месяц вне 1–12`);
    }
  }
});

test('у условно съедобных и опасных видов есть пояснение', () => {
  for (const r of records) {
    if (DANGER_RANK[r.edibility] === 0 || r.edibility === 'inedible') continue;
    assert.ok(r.edibilityNote && r.edibilityNote.length > 20, `${r.id}: нет пояснения edibilityNote`);
  }
});

test('пары двойников ссылаются на существующие виды и не повторяются', () => {
  const seen = new Set<string>();
  for (const p of pairs) {
    assert.ok(db.get(p.a), `неизвестный вид ${p.a} в lookalikes.json`);
    assert.ok(db.get(p.b), `неизвестный вид ${p.b} в lookalikes.json`);
    assert.notEqual(p.a, p.b);
    const key = [p.a, p.b].sort().join('|');
    assert.ok(!seen.has(key), `повтор пары ${key}`);
    seen.add(key);
    assert.ok(p.howToTell.length > 30, `${key}: слишком короткое описание отличий`);
  }
});

test('связь двойников симметрична', () => {
  for (const s of db.all) {
    for (const l of s.lookalikes) {
      const back = db.get(l.id)!.lookalikes.some((x) => x.id === s.id);
      assert.ok(back, `${s.id} → ${l.id} без обратной связи`);
    }
  }
});

test('у каждого смертельно ядовитого вида указан хотя бы один съедобный двойник', () => {
  for (const s of db.all.filter((x) => x.edibility === 'deadly')) {
    const edibleTwin = s.lookalikes.some((l) => !isDangerous(db.get(l.id)!.edibility));
    assert.ok(edibleTwin, `${s.id}: не указано, с чем его путают`);
  }
});

test('метки модели (если модель уже обучена) есть в базе', () => {
  const meta = join(import.meta.dirname, '..', 'assets', 'model', 'model-meta.json');
  if (!existsSync(meta)) return;
  const { labels } = JSON.parse(readFileSync(meta, 'utf8')) as { labels: string[] };
  for (const label of labels) {
    if (SERVICE_LABELS.includes(label)) continue;
    assert.ok(db.get(label), `модель знает вид ${label}, которого нет в базе`);
  }
});
