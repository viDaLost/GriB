import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { classifyBlob, isModelInstalled } from '../ml/webClassifier';
import { addShot, getSession, MAX_SHOTS, SHOT_HINTS, useScanSession } from '../state/scanSession';
import { Button } from '../ui/components';
import { colors, radius, spacing } from '../ui/theme';

/** Открыть системный выбор фото. С capture на iPhone/Android сразу открывается камера. */
function pickFile(capture: boolean): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.setAttribute('capture', 'environment');
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export default function ScanWebScreen() {
  const session = useScanSession();
  const step = Math.min(session.shots.length, MAX_SHOTS - 1);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const analyze = async (capture: boolean) => {
    if (busy) return;
    const file = await pickFile(capture);
    if (!file) return;
    setBusy(true);
    setStatus('Определяю…');
    try {
      const probs = await classifyBlob(file);
      const continuing = getSession().shots.length > 0;
      addShot({ uri: URL.createObjectURL(file), probs });
      if (continuing) router.back();
      else router.replace('/result');
    } catch (e) {
      setStatus(`Не удалось определить: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  if (!isModelInstalled()) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Модель ещё не установлена</Text>
        <Button title="Определить по признакам" onPress={() => router.replace('/key')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.step}>
        Снимок {step + 1} из {MAX_SHOTS}
      </Text>
      <Text style={styles.title}>{SHOT_HINTS[step]}</Text>

      <View style={styles.frame}>
        <Text style={styles.frameText}>
          Гриб должен занимать большую часть кадра. Снимайте при хорошем свете, без вспышки в упор.
        </Text>
      </View>

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.status}>{status}</Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button title="📷  Сфотографировать" onPress={() => void analyze(true)} />
          <Button title="Выбрать из галереи" variant="secondary" onPress={() => void analyze(false)} />
          {status ? <Text style={styles.error}>{status}</Text> : null}
        </View>
      )}

      <Text style={styles.note}>
        Фото обрабатывается прямо на телефоне и никуда не отправляется. Первое определение может
        занять несколько секунд — загружается модель.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, gap: spacing.l, backgroundColor: colors.bg },
  step: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  frame: {
    aspectRatio: 1,
    borderRadius: radius.l,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  frameText: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  actions: { gap: spacing.m },
  busy: { alignItems: 'center', gap: spacing.s, padding: spacing.l },
  status: { color: colors.text, fontSize: 15 },
  error: { color: '#8E0E0E', fontSize: 14, textAlign: 'center' },
  note: { fontSize: 13, color: colors.muted, textAlign: 'center' },
});
