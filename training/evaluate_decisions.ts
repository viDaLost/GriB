import { readFileSync, writeFileSync } from 'node:fs';
import { identify } from '../app/src/ml/decision.ts';
import { isDangerous } from '../app/src/data/types.ts';
import { db } from '../app/test/loadDb.ts';

// Evaluate the application's actual warning logic, rather than a Python approximation.
interface Input { labels: string[]; samples: { truth: string; probabilities: number[] }[] }
const data = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Input;
let dangerous = 0, unwarnedConfidentEdible = 0, unknown = 0, unknownAsConfident = 0;
for (const sample of data.samples) {
  // Season changes the ranking, so evaluate every month as well as no date.
  const results = [undefined, ...Array.from({ length: 12 }, (_, i) => i + 1)]
    .map(month => identify(sample.probabilities, data.labels, db, { month }));
  if (isDangerous(db.get(sample.truth)?.edibility ?? 'inedible')) {
    dangerous++;
    if (results.some(result => {
      const top = result.candidates[0]?.species;
      const warned = result.dangerousCandidates.some(c => c.species.id === sample.truth)
        || result.dangerousLookalikes.some(s => s.id === sample.truth);
      return result.verdict === 'confident' && top
        && ['edible', 'conditionally_edible'].includes(top.edibility) && !warned;
    })) unwarnedConfidentEdible++;
  }
  if (sample.truth === '__other_fungus__' || sample.truth === '__not_mushroom__') {
    unknown++;
    if (results.some(r => r.verdict === 'confident')) unknownAsConfident++;
  }
}
writeFileSync(process.argv[3]!, JSON.stringify({dangerous, unwarnedConfidentEdible,
  unwarnedConfidentEdibleRate: dangerous ? unwarnedConfidentEdible / dangerous : 0,
  unknown, unknownAsConfident, unknownAsConfidentRate: unknown ? unknownAsConfident / unknown : 0}, null, 2));
