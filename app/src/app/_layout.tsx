import { GolosText_400Regular } from '@expo-google-fonts/golos-text/400Regular';
import { GolosText_500Medium } from '@expo-google-fonts/golos-text/500Medium';
import { GolosText_600SemiBold } from '@expo-google-fonts/golos-text/600SemiBold';
import { GolosText_700Bold } from '@expo-google-fonts/golos-text/700Bold';
import { Literata_400Regular_Italic } from '@expo-google-fonts/literata/400Regular_Italic';
import { Literata_600SemiBold } from '@expo-google-fonts/literata/600SemiBold';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { warmUpModel } from '../ml/classifier';
import { BottomNav } from '../ui/BottomNav';
import { Button } from '../ui/components';
import { fonts, colors, spacing } from '../ui/theme';

const DISCLAIMER_KEY = 'disclaimer-accepted-v1';

export default function RootLayout() {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  // Шрифты встроены в приложение; если загрузка не удалась, остаются системные.
  const [fontsLoaded, fontError] = useFonts({
    Literata_600SemiBold, Literata_400Regular_Italic,
    GolosText_400Regular, GolosText_500Medium, GolosText_600SemiBold, GolosText_700Bold,
  });

  useEffect(() => {
    AsyncStorage.getItem(DISCLAIMER_KEY)
      .then((v) => setAccepted(v === 'yes'))
      .catch(() => setAccepted(false));
    warmUpModel();
  }, []);

  if (accepted === null || (!fontsLoaded && !fontError)) return <View style={styles.fill} />;
  if (!accepted) {
    return (
      <Disclaimer
        onAccept={() => {
          AsyncStorage.setItem(DISCLAIMER_KEY, 'yes').catch(() => {});
          setAccepted(true);
        }}
      />
    );
  }

  return (
    <View style={styles.shell}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontSize: 20, fontFamily: fonts.display },
          contentStyle: { backgroundColor: colors.bg },
          headerBackTitle: 'Назад',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Грибник', headerShown: false }} />
        <Stack.Screen
          name="scan"
          // В браузере экран съёмки — обычная страница с кнопкой «назад»; на телефоне — полноэкранная камера.
          options={{ headerShown: Platform.OS === 'web', title: 'Фото гриба' }}
        />
        <Stack.Screen name="result" options={{ title: 'Результат' }} />
        <Stack.Screen name="catalog" options={{ title: 'Атлас' }} />
        <Stack.Screen name="map" options={{ title: 'Карта' }} />
        <Stack.Screen name="key" options={{ title: 'Определить без фото' }} />
        <Stack.Screen name="species/[id]" options={{ title: '' }} />
        <Stack.Screen name="safety" options={{ title: 'Безопасность' }} />
      </Stack>
      <BottomNav />
    </View>
  );
}

function Disclaimer({ onAccept }: { onAccept: () => void }) {
  return (
    <SafeAreaView style={styles.fill}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.disclaimer}>
        <Text style={styles.brand}>грибник</Text>
        <Text style={styles.title}>Прежде чем начать</Text>
        <Text style={styles.p}>
          Ваш карманный лесной атлас: «Грибник» помогает узнать, на какой гриб похож найденный, и показывает его признаки и
          опасных двойников. Приложение работает без интернета.
        </Text>
        <Text style={styles.warning}>
          Распознавание по фото может ошибаться. Никогда не ешьте гриб только потому, что так
          решило приложение.
        </Text>
        <Text style={styles.p}>
          • Собирайте только те грибы, которые знаете сами наверняка.{'\n'}
          • Сомневаетесь — не берите. Покажите гриб опытному грибнику.{'\n'}
          • Смертельно ядовитые грибы (бледная поганка, мухомор вонючий, галерина) похожи на
          съедобные, а первые признаки отравления появляются через 6–24 часа.{'\n'}
          • При подозрении на отравление звоните 103 или 112.
        </Text>
        <Text style={styles.small}>
          Справочная информация собрана из открытых источников и требует проверки специалистом.
        </Text>
        <Button title="Понятно, продолжить" onPress={onAccept} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', backgroundColor: colors.bg },
  fill: { flex: 1, backgroundColor: colors.bg },
  brand: { fontSize: 26, lineHeight: 32, fontFamily: fonts.display, color: colors.primary, marginTop: spacing.xl },
  disclaimer: { padding: spacing.xl, gap: spacing.l },
  title: { fontSize: 30, fontFamily: fonts.display, color: colors.text, marginTop: spacing.xl },
  p: { fontSize: 19, fontFamily: fonts.body, lineHeight: 29, color: colors.text },
  warning: {
    fontSize: 19, fontFamily: fonts.bold,
    lineHeight: 29,
    color: '#8E0E0E',
    backgroundColor: '#F7C9C9',
    padding: spacing.l,
    borderRadius: 12,
  },
  small: { fontSize: 15, fontFamily: fonts.body, color: colors.muted },
});
