import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useSyncExternalStore } from 'react';
import { parseFinds, type Find } from '../data/finds';

const KEY = 'gribnik.finds.v1';
let finds: Find[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit(next: Find[]) {
  finds = next;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      // Находки, добавленные до окончания чтения, не теряем.
      const stored = parseFinds(raw).filter((f) => !finds.some((x) => x.id === f.id));
      finds = [...finds, ...stored];
      listeners.forEach((l) => l());
    })
    .catch(() => {});
}

export function useFinds(): Find[] {
  load();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => finds,
    () => finds,
  );
}

export function removeFind(id: string): void {
  emit(finds.filter((f) => f.id !== id));
}

/** Определяет координаты и сохраняет находку. Бросает ошибку с понятным текстом. */
export async function saveFindHere(speciesId?: string): Promise<Find> {
  load();
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new Error('Нет доступа к геолокации. Разрешите его в настройках браузера или телефона.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const find: Find = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    speciesId,
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null,
    date: new Date().toISOString(),
  };
  emit([find, ...finds]);
  return find;
}
