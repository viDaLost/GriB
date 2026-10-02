import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modelCoverage, trainedSpeciesCount } from '../src/ml/modelCoverage.ts';
import type { ModelMeta } from '../src/ml/modelMeta.ts';

const meta: ModelMeta = { version: 'test', createdAt: '', architecture: 'test',
  input: { size: 224, dtype: 'float32', normalization: 'raw255' },
  labels: ['boletus-edulis', 'lactarius-deterrimus', '__other_fungus__'],
  perClass: { 'lactarius-deterrimus': { n: 8, correct: 4, recall: .5 } } };

test('каталог не обещает распознавание необученного вида и отмечает малую проверочную выборку', () => {
  assert.match(modelCoverage('agaricus-augustus', meta), /не обучена/);
  assert.match(modelCoverage('lactarius-deterrimus', meta), /пока мало/);
  assert.match(modelCoverage('boletus-edulis', meta), /нужно проверить/);
  assert.equal(trainedSpeciesCount(['boletus-edulis', 'agaricus-augustus'], meta), 1);
  assert.equal(trainedSpeciesCount(['boletus-edulis'], null), 0);
});
