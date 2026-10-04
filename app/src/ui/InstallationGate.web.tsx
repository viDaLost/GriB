import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { needsIOSInstallation } from './installEnvironment';
import { colors } from './theme';

const steps = [
  ['Откройте сайт в Safari', 'Если вы пришли из Telegram, Chrome или другого приложения, скопируйте ссылку ниже и вставьте её в Safari.'],
  ['Нажмите «Поделиться»', 'Найдите значок квадрата со стрелкой вверх. В некоторых версиях Safari он находится в меню страницы «…».'],
  ['Выберите «На экран Домой»', 'Прокрутите меню вниз. Если пункта нет, найдите его через «Редактировать действия».'],
  ['Добавьте и откройте «Грибник»', 'Если есть переключатель «Открывать как веб-приложение», включите его. Нажмите «Добавить», затем запустите «Грибник» с новой иконки на главном экране.'],
];

function needsInstallInBrowser() {
  return needsIOSInstallation({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    standaloneDisplay: window.matchMedia('(display-mode: standalone)').matches,
  });
}

function subscribeToLaunchMode(check: () => void) {
  const display = window.matchMedia('(display-mode: standalone)');
  display.addEventListener('change', check);
  window.addEventListener('pageshow', check);
  return () => {
    display.removeEventListener('change', check);
    window.removeEventListener('pageshow', check);
  };
}

export function InstallationGate({ children }: { children: ReactNode }) {
  // Same first render on the server and client: no app flash or model warm-up on iOS.
  const requiresInstall = useSyncExternalStore<boolean | null>(subscribeToLaunchMode, needsInstallInBrowser, () => null);
  const url = typeof window === 'undefined' ? '' : window.location.href;
  const [copyStatus, setCopyStatus] = useState('');

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus('Ссылка скопирована. Вставьте её в адресную строку Safari.');
    } catch {
      setCopyStatus('Нажмите и удерживайте ссылку ниже, затем выберите «Скопировать».');
    }
  }

  if (requiresInstall === null) return <View style={styles.fill} />;
  if (!requiresInstall) return <>{children}</>;

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      <View style={styles.brand}>
        <View style={styles.logo}><Icon name="mushroom" size={38} color={colors.primaryText} /></View>
        <Text style={styles.brandText}>грибник</Text>
      </View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>ВАШ ЛЕСНОЙ СПУТНИК</Text>
        <Text accessibilityRole="header" style={styles.title}>Добавьте лесной атлас на экран телефона</Text>
        <Text style={styles.description}>На iPhone и iPad «Грибник» открывается с иконки на главном экране — как отдельное приложение.</Text>
        <View style={styles.preview}>
          <View style={styles.appIcon}><Icon name="mushroom" size={52} color={colors.primaryText} /></View>
          <Text style={styles.previewLabel}>Грибник</Text>
        </View>
        <Text style={styles.free}>Бесплатно · без App Store</Text>
      </View>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Четыре простых шага</Text>
      {steps.map(([title, description], index) => (
        <View key={title} style={styles.step}>
          <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={copyLink} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Скопировать ссылку для Safari</Text>
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{copyStatus}</Text>
      <Text selectable style={styles.url}>{url}</Text>
      <View style={styles.note}>
        <Icon name="check" size={26} />
        <Text style={styles.noteText}>Уже добавили? Закройте браузер и нажмите иконку «Грибник» на главном экране.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  page: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, paddingTop: 28, paddingBottom: 40, gap: 16 },
  brand: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 8 },
  logo: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  brandText: { fontSize: 30, fontWeight: '800', color: colors.text },
  hero: { padding: 24, borderRadius: 26, backgroundColor: colors.sage, gap: 16 },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 1.6, color: colors.muted },
  title: { fontSize: 32, lineHeight: 39, fontWeight: '800', color: colors.text },
  description: { fontSize: 18, lineHeight: 27, color: colors.muted },
  preview: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  appIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  previewLabel: { fontSize: 17, fontWeight: '600', color: colors.text },
  free: { fontSize: 16, color: colors.primary, textAlign: 'center' },
  sectionTitle: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: colors.text, marginTop: 8 },
  step: { flexDirection: 'row', gap: 14, padding: 18, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  number: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 20, fontWeight: '700', color: colors.primary },
  stepBody: { flex: 1, minWidth: 0, gap: 8 },
  stepTitle: { fontSize: 21, lineHeight: 28, fontWeight: '700', color: colors.text },
  button: { minHeight: 64, padding: 18, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 19, lineHeight: 27, fontWeight: '700', color: colors.primaryText, textAlign: 'center' },
  pressed: { opacity: 0.75 },
  status: { fontSize: 16, lineHeight: 24, color: colors.primary },
  url: { fontSize: 16, lineHeight: 24, color: colors.muted },
  note: { flexDirection: 'row', gap: 12, padding: 18, borderRadius: 18, backgroundColor: colors.sage },
  noteText: { flex: 1, fontSize: 17, lineHeight: 25, color: colors.text },
});
