import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answeredCount, isApplicable, QUESTION_BY_ID, toggleAnswer } from '../src/data/questions.ts';
import { conflictingShots } from '../src/ml/ensemble.ts';

test('цвет сока не учитывается без сока; ответ сбрасывается вместе с родительским признаком', () => {
  assert.equal(isApplicable(QUESTION_BY_ID.milkColor, {}), false);
  assert.equal(isApplicable(QUESTION_BY_ID.milkColor, { milk: true }), true);
  assert.equal(answeredCount({ milk: false, milkColor: 'orange' }), 1);
  assert.equal(toggleAnswer({ milk: true, milkColor: 'orange' }, 'milk', 'no').milkColor, undefined);
});

test('разные сильные ответы требуют уточнения, слабые альтернативы не создают конфликт', () => {
  assert.equal(conflictingShots([[0.8, 0.2], [0.1, 0.9]]), true);
  assert.equal(conflictingShots([[0.8, 0.2], [0.75, 0.25]]), false);
  assert.equal(conflictingShots([[0.4, 0.3, 0.3], [0.2, 0.4, 0.4]]), false);
});
