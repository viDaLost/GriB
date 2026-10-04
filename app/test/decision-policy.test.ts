import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('правила отказа нельзя подбирать на тестовой выборке', () => {
  const directory = mkdtempSync(join(tmpdir(), 'grib-policy-'));
  try {
    const source = join(directory, 'input.json');
    writeFileSync(source, JSON.stringify({ split: 'test', labels: [], samples: [] }));
    const script = fileURLToPath(new URL('../../training/fit_decision_policy.ts', import.meta.url));
    const result = spawnSync(process.execPath, [script, source, join(directory, 'result.json')], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /only be fitted on validation photos/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
