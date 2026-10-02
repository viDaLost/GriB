import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { runKey } from '../src/data/key.ts';
import {
  COLOR_LABEL,
  CUT_LABEL,
  FORM_LABEL,
  SUBSTRATE_LABEL,
  UNDERSIDE_LABEL,
  type Traits,
} from '../src/data/traits.ts';
import { db } from './loadDb.ts';

const traits = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'src', 'data', 'species', 'traits.json'), 'utf8'),
) as Record<string, Traits>;

test('признаки заданы для каждого вида и корректны', () => {
  assert.deepEqual(Object.keys(traits).sort(), db.all.map((s) => s.id).sort());
  for (const [id, t] of Object.entries(traits)) {
    assert.ok(t.form in FORM_LABEL, `${id}: form`);
    if (t.form === 'cap') assert.ok(t.underside && t.underside in UNDERSIDE_LABEL, `${id}: underside`);
    assert.ok(t.colors.length > 0 && t.colors.every((c) => c in COLOR_LABEL), `${id}: colors`);
    assert.ok(t.cut == null || t.cut.every((c) => c in CUT_LABEL), `${id}: cut`);
    assert.ok(t.substrate == null || t.substrate in SUBSTRATE_LABEL, `${id}: substrate`);
    // Трубчатость в признаках и в карточке должна совпадать.
    const s = db.get(id)!;
    if (t.underside === 'tubes') assert.equal(s.hymenophore, 'tubes', `${id}: гименофор`);
  }
});

test('бледная поганка по признакам: первая и в блоке опасных', () => {
  const r = runKey(db, traits, {
    form: 'cap', underside: 'gills', color: 'green', ring: true, volva: true, milk: false, substrate: 'soil',
  });
  assert.equal(r.matches[0]!.species.id, 'amanita-phalloides');
  assert.ok(r.dangerous.some((m) => m.species.id === 'amanita-phalloides'));
});

test('зелёная сыроежка без кольца — сыроежка выше, но поганка всё равно предупреждением', () => {
  const r = runKey(db, traits, { form: 'cap', underside: 'gills', color: 'green' });
  assert.ok(r.dangerous.some((m) => m.species.id === 'amanita-phalloides'));
  const r2 = runKey(db, traits, { form: 'cap', underside: 'gills', color: 'green', ring: false, volva: false });
  assert.equal(r2.matches[0]!.species.edibility === 'deadly', false);
});

test('губка + синеет: только трубчатые', () => {
  const r = runKey(db, traits, { form: 'cap', underside: 'tubes', cut: 'blue' });
  assert.ok(r.matches.length > 0);
  assert.ok(r.matches.every((m) => m.species.hymenophore === 'tubes'));
  assert.ok(r.dangerous.some((m) => m.species.id === 'rubroboletus-satanas'));
});

test('оранжевый млечный сок, зеленеет — рыжики', () => {
  const r = runKey(db, traits, { form: 'cap', underside: 'gills', color: 'orange', milk: true, cut: 'green' });
  assert.ok(r.matches[0]!.species.id.startsWith('lactarius-de'));
});

test('без ответов — пустой результат', () => {
  const r = runKey(db, traits, { month: 8 });
  assert.equal(r.matches.length, 0);
  assert.equal(r.answered, 0);
});

test('несезонный вид не исчезает', () => {
  const r = runKey(db, traits, { form: 'morel', month: 8 });
  assert.ok(r.matches.some((m) => m.species.id === 'gyromitra-esculenta'));
  assert.ok(r.dangerous.some((m) => m.species.id === 'gyromitra-esculenta'));
});
