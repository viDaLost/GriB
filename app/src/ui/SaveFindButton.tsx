import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { saveFindHere } from '../state/finds';
import { Button } from './components';
import { colors } from './theme';

/** Сохраняет текущее место как находку — она появится на карте в слое «Мои находки». */
export function SaveFindButton({ speciesId }: { speciesId?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  if (state === 'saved') {
    return (
      <View style={styles.box}>
        <Text style={styles.ok}>Место сохранено в «Мои находки».</Text>
        <Button title="Открыть на карте" icon="map" variant="secondary" onPress={() => router.push({ pathname: '/map', params: { layer: 'mine' } })} />
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <Button
        title={state === 'busy' ? 'Определяю место…' : 'Сохранить место находки'}
        icon="map"
        variant="secondary"
        disabled={state === 'busy'}
        onPress={() => {
          setState('busy');
          setError(null);
          saveFindHere(speciesId)
            .then(() => setState('saved'))
            .catch((e: unknown) => {
              setState('idle');
              setError(e instanceof Error ? e.message : 'Не удалось определить место.');
            });
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  ok: { fontSize: 17, color: colors.primary, fontWeight: '600' },
  error: { fontSize: 16, color: colors.accent },
});
