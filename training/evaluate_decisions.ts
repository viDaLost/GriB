import { readFileSync, writeFileSync } from 'node:fs';
import { evaluateDecisions, type Predictions } from './decision_metrics.ts';

// Evaluate the application's actual warning logic, rather than a Python approximation.
const data = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Predictions;
writeFileSync(process.argv[3]!, JSON.stringify(evaluateDecisions(data), null, 2));
