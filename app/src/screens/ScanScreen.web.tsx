import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { classifyBlob, isModelInstalled } from '../ml/webClassifier';
import { addShot, getSession, MAX_SHOTS, SHOT_HINTS, useScanSession } from '../state/scanSession';
import { Button } from '../ui/components';
import { Icon } from '../ui/Icon';
import { PhotoCrop } from '../ui/PhotoCrop.web';
import { colors, radius, spacing } from '../ui/theme';

function pickFile(capture: boolean): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    if (capture) input.setAttribute('capture', 'environment');
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export default function ScanWebScreen() {
  const session = useScanSession();
  const step = Math.min(session.shots.length, MAX_SHOTS - 1);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [status, setStatus] = useState('');
  const select = async (capture: boolean) => { const selected = await pickFile(capture); if (selected) { setFile(selected); setStatus(''); } };
  const analyze = async (blob: Blob) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setStatus('Подготавливаю модель…');
    try {
      const probs = await classifyBlob(blob, (done, total) => setStatus(`Сравниваю признаки · ${done} из ${total}`));
      const continuing = getSession().shots.length > 0;
      addShot({ uri: URL.createObjectURL(blob), probs });
      if (continuing && router.canGoBack()) router.back(); else router.replace('/result');
    } catch (e) { setStatus(`Не удалось определить: ${e instanceof Error ? e.message : String(e)}`); }
    finally { lock.current = false; setBusy(false); }
  };

  if (!isModelInstalled()) return <View style={styles.container}><Text style={styles.title}>Модель ещё не установлена</Text><Button title="Определить по признакам" icon="sliders" onPress={() => router.replace('/key')} /></View>;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.steps}>{Array.from({ length: MAX_SHOTS }, (_, i) => <View key={i} style={[styles.stepDot, i <= step && styles.stepActive]}><Text style={[styles.stepNumber, i <= step && { color: '#fff' }]}>{i + 1}</Text></View>)}</View>
      <Text style={styles.step}>ОДИН ГРИБ · ТРИ РАКУРСА</Text>
      <Text style={styles.title}>{SHOT_HINTS[step]}</Text>
      {file ? <PhotoCrop key={`${file.name}-${file.lastModified}-${file.size}`} file={file} disabled={busy} onAnalyze={(blob) => void analyze(blob)} /> :
        <View style={styles.frame}><View style={styles.camera}><Icon name="camera" size={42} /></View><Text style={styles.frameTitle}>Начнём со снимка</Text><Text style={styles.frameText}>Один гриб крупно, при дневном свете. Затем можно добавить низ шляпки и основание ножки.</Text></View>}
      {busy ? <View accessibilityLiveRegion="polite" style={styles.busy}><ActivityIndicator color={colors.primary} /><Text style={styles.status}>{status}</Text></View> :
        <View style={styles.actions}><Button title={file ? 'Переснять' : 'Сфотографировать'} icon="camera" onPress={() => void select(true)} /><Button title={file ? 'Выбрать другое фото' : 'Выбрать из галереи'} icon="gallery" variant="secondary" onPress={() => void select(false)} />{status ? <Text accessibilityLiveRegion="polite" style={styles.error}>{status}</Text> : null}</View>}
      <View style={styles.note}><Icon name="shield" size={20} /><Text style={styles.noteText}>Фото обрабатывается на вашем устройстве. Первый запуск требует загрузки модели; затем приложение работает офлайн.</Text></View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, paddingBottom: 28, backgroundColor: colors.bg },
  steps: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  stepActive: { backgroundColor: colors.primary }, stepNumber: { color: colors.primary, fontWeight: '700' },
  step: { color: colors.muted, fontSize: 13, letterSpacing: 1.5, textAlign: 'center' },
  title: { fontSize: 28, lineHeight: 35, fontWeight: '700', color: colors.text, textAlign: 'center' },
  frame: { minHeight: 220, borderRadius: radius.l, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 14 },
  camera: { backgroundColor: colors.card, width: 82, height: 82, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  frameTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  frameText: { fontSize: 17, color: colors.muted, textAlign: 'center', lineHeight: 27 },
  actions: { gap: spacing.m }, busy: { alignItems: 'center', gap: spacing.s, padding: spacing.l },
  status: { color: colors.text, fontSize: 18 }, error: { color: '#8E0E0E', fontSize: 17, textAlign: 'center' },
  note: { flexDirection: 'row', gap: 10 }, noteText: { flex: 1, fontSize: 15, lineHeight: 23, color: colors.muted },
});
