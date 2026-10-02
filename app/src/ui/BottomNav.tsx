import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startSession } from '../state/scanSession';
import { Icon, type IconName } from './Icon';
import { colors } from './theme';

const tabs: { path: '/' | '/catalog' | '/scan' | '/key' | '/safety'; label: string; icon: IconName }[] = [
  { path: '/', label: 'Главная', icon: 'leaf' },
  { path: '/catalog', label: 'Атлас', icon: 'book' },
  { path: '/scan', label: 'Сканер', icon: 'camera' },
  { path: '/key', label: 'Признаки', icon: 'sliders' },
  { path: '/safety', label: 'Помощь', icon: 'shield' },
];

export function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  if (pathname === '/scan') return null;
  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const active = tab.path === pathname || (tab.path === '/catalog' && pathname.startsWith('/species'));
        const scan = tab.path === '/scan';
        return (
          <Pressable key={tab.path} accessibilityRole="button" accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (scan) startSession();
              router.navigate(tab.path);
            }}
            style={({ pressed }) => [styles.tab, pressed && { opacity: 0.65 }]}>
            <View style={[styles.icon, active && styles.active, scan && styles.scan]}>
              <Icon name={tab.icon} size={23} color={scan ? '#fff' : active ? colors.primary : colors.muted} />
            </View>
            <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 },
  tab: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: { width: 44, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: colors.sage },
  scan: { backgroundColor: colors.primary },
  label: { fontSize: 10, color: colors.muted, fontWeight: '500' },
  activeLabel: { color: colors.primary, fontWeight: '700' },
});
