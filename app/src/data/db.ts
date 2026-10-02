import { buildDatabase, type LookalikePair, type SpeciesRecord } from './buildDatabase';
import dangerous from './species/dangerous.json';
import gilled from './species/gilled.json';
import lookalikes from './species/lookalikes.json';
import other from './species/other.json';
import tubular from './species/tubular.json';

/** Вся база видов — встроена в приложение и работает без интернета. */
export const db = buildDatabase(
  [...dangerous, ...tubular, ...gilled, ...other] as SpeciesRecord[],
  lookalikes as LookalikePair[],
);
