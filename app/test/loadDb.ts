import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDatabase, type LookalikePair, type SpeciesRecord } from '../src/data/buildDatabase.ts';

const dir = join(import.meta.dirname, '..', 'src', 'data', 'species');
const read = <T>(file: string): T => JSON.parse(readFileSync(join(dir, file), 'utf8')) as T;

export const SPECIES_FILES = ['dangerous.json', 'tubular.json', 'gilled.json', 'other.json'];

export const records: SpeciesRecord[] = SPECIES_FILES.flatMap((f) => read<SpeciesRecord[]>(f));
export const pairs: LookalikePair[] = read<LookalikePair[]>('lookalikes.json');
export const db = buildDatabase(records, pairs);
