import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startSession } from '../state/scanSession';
import { Icon, type IconName } from './Icon';
import { Button } from './components';
import { colors } from './theme';

const tabs: { path: '/' | '/catalog' | '/scan' | '/map' | 'more'; label: string; icon: IconName; short?: string }[] = [
  { path: '/', label: 'Главная', short: 'Домой', icon: 'leaf' },
  { path: '/catalog', label: 'Атлас', icon: 'book' },
  { path: '/scan', label: 'Сканер', short: 'Фото', icon: 'camera' },
  { path: '/map', label: 'Карта', icon: 'map' },
  { path: 'more', label: 'Ещё', icon: 'more' },
];

export function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [more, setMore] = useState(false);
  if (pathname === '/scan') return null;
  const navigate = (path: '/key' | '/safety') => { setMore(false); router.navigate(path); };
  return <>
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {tabs.map((tab) => {
        const active = tab.path === pathname || (tab.path === '/catalog' && pathname.startsWith('/species')) || (tab.path === 'more' && ['/key', '/safety'].includes(pathname));
        const scan = tab.path === '/scan';
        return <Pressable key={tab.path} accessibilityRole="button" accessibilityLabel={tab.label}
          accessibilityState={{ selected: active, expanded: tab.path === 'more' ? more : undefined }}
          onPress={() => {
            if (tab.path === 'more') { setMore(true); return; }
            if (scan) startSession();
            router.navigate(tab.path);
          }} style={({ pressed }) => [styles.tab, pressed && { opacity: 0.65 }]}>
          <View style={[styles.icon, active && styles.active, scan && styles.scan]}>
            <Icon name={tab.icon} size={34} color={scan ? '#fff' : active ? colors.primary : colors.muted} />
          </View>
          <Text style={[styles.label, width < 360 && styles.compactLabel, active && styles.activeLabel]}>{tab.short ?? tab.label}</Text>
        </Pressable>;
      })}
    </View>
    <Modal visible={more} transparent animationType="slide" onRequestClose={() => setMore(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Закрыть меню" onPress={() => setMore(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <Text style={styles.sheetTitle}>Ещё в «Грибнике»</Text>
            <Button title="По признакам" icon="sliders" onPress={() => navigate('/key')} />
            <Text style={styles.sheetHint}>Определяйте гриб шаг за шагом: шляпка, ножка и млечный сок.</Text>
            <Button title="Безопасность и помощь" icon="shield" variant="secondary" onPress={() => navigate('/safety')} />
            <Button title="Закрыть" icon="close" variant="secondary" onPress={() => setMore(false)} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border, paddingTop: 12 },
  tab: { flex: 1, minWidth: 0, minHeight: 94, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center', gap: 8 },
  icon: { width: 56, height: 52, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: colors.sage }, scan: { backgroundColor: colors.primary },
  label: { fontSize: 16, lineHeight: 22, color: colors.muted, fontWeight: '600', textAlign: 'center', alignSelf: 'stretch' },
  compactLabel: { fontSize: 15, letterSpacing: -0.3 },
  activeLabel: { color: colors.primary, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(20,40,30,0.45)' },
  sheet: { width: '100%', maxWidth: 760, maxHeight: '85%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.bg, padding: 20 },
  sheetContent: { gap: 16 },
  sheetTitle: { fontSize: 26, lineHeight: 34, fontWeight: '700', color: colors.text },
  sheetHint: { fontSize: 18, lineHeight: 27, color: colors.muted },
});
