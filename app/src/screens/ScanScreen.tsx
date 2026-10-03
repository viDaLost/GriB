import * as ImagePicker from 'expo-image-picker';
import { router, useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { loadImage, type Image } from 'react-native-nitro-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { classifyImage, isModelInstalled } from '../ml/classifier';
import { addShot, getSession, MAX_SHOTS, SHOT_HINTS, useScanSession } from '../state/scanSession';
import { Button } from '../ui/components';
import { Icon } from '../ui/Icon';
import { fonts, colors, spacing } from '../ui/theme';

/** Соотношение сторон снимка (портрет 3:4) — превью показываем целиком, без обрезки. */
const PHOTO_ASPECT = 4 / 3;

export default function ScanScreen() {
  const focused = useIsFocused();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const permission = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'speed' });
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const session = useScanSession();
  const step = Math.min(session.shots.length, MAX_SHOTS - 1);

  const analyze = async (getImage: () => Promise<{ image: Image; uri: string } | null>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const picked = await getImage();
      if (!picked) return;
      let probs: number[];
      try { probs = await classifyImage(picked.image); }
      finally { picked.image.dispose(); }
      const continuing = getSession().shots.length > 0;
      addShot({ uri: picked.uri, probs });
      // Первый снимок — открываем результат; следующие — возвращаемся к нему.
      if (continuing && router.canGoBack()) router.back();
      else router.replace('/result');
    } catch (e) {
      Alert.alert('Не удалось определить', e instanceof Error ? e.message : String(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const takePhoto = () =>
    analyze(async () => {
      const photo = await photoOutput.capturePhoto({ enableShutterSound: false }, {});
      const image = await photo.toImageAsync();
      const path = await photo.saveToTemporaryFileAsync();
      photo.dispose();
      return { image, uri: path.startsWith('file://') ? path : `file://${path}` };
    });

  const pickFromGallery = () =>
    analyze(async () => {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      const asset = res.canceled ? undefined : res.assets[0];
      if (!asset) return null;
      const image = await loadImage({ filePath: asset.uri });
      return { image, uri: asset.uri };
    });

  if (!isModelInstalled()) {
    return (
      <Message
        title="Модель ещё не установлена"
        text="Распознавание по фото заработает в следующей версии приложения. Пока определите гриб по признакам — это тоже работает без интернета."
        action={{ title: 'Определить по признакам', onPress: () => router.replace('/key') }}
      />
    );
  }

  if (!permission.hasPermission) {
    return (
      <Message
        title="Нужен доступ к камере"
        text="Камера нужна, чтобы сфотографировать гриб. Снимки никуда не отправляются — всё обрабатывается на телефоне."
        action={
          permission.canRequestPermission
            ? { title: 'Разрешить камеру', onPress: () => void permission.requestPermission() }
            : undefined
        }
        secondary={{ title: 'Выбрать фото из галереи', onPress: pickFromGallery }}
      />
    );
  }

  const previewHeight = Math.min(width * PHOTO_ASPECT, Math.max(180, (height - insets.top - insets.bottom - 240)));
  const guide = Math.min(width, previewHeight / PHOTO_ASPECT);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть камеру" onPress={() => router.back()} hitSlop={12} style={styles.topButton}>
          <Icon name="close" color="#fff" /><Text style={styles.topText}>Закрыть</Text>
        </Pressable>
        {device?.hasFlash ? (
          <Pressable accessibilityRole="button" onPress={() => setTorch((t) => !t)} hitSlop={12} style={styles.topButton}>
            <Text style={styles.topText}>{torch ? 'Фонарик: вкл' : 'Фонарик: выкл'}</Text>
          </Pressable>
        ) : null}
      </SafeAreaView>

      <View style={{ width, height: previewHeight }}>
        {device ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={focused && !busy}
            outputs={[photoOutput]}
            resizeMode="contain"
            torchMode={torch ? 'on' : 'off'}
            enableNativeTapToFocusGesture
          />
        ) : (
          <Text style={styles.hint}>Камера не найдена</Text>
        )}
        {/* Рамка = центральный квадрат снимка, который увидит модель */}
        <View pointerEvents="none" style={styles.guideWrap}>
          <View style={[styles.guide, { width: guide, height: guide }]} />
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.bottom}>
        <View>
          <Text style={styles.step}>
            Снимок {step + 1} из {MAX_SHOTS}
          </Text>
          <Text style={styles.hint}>{SHOT_HINTS[step]}</Text>
        </View>
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Выбрать из галереи" onPress={pickFromGallery} style={styles.sideButton} disabled={busy}>
            <Icon name="gallery" color="#fff" />
            <Text style={styles.sideText}>Галерея</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Сфотографировать и определить"
            onPress={takePhoto}
            disabled={busy || !device}
            style={({ pressed }) => [styles.shutter, pressed && { opacity: 0.7 }]}
          >
            {busy ? <ActivityIndicator color={colors.primary} /> : <View style={styles.shutterInner} />}
          </Pressable>
          <View style={styles.sideButton} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function Message({
  title,
  text,
  action,
  secondary,
}: {
  title: string;
  text: string;
  action?: { title: string; onPress: () => void };
  secondary?: { title: string; onPress: () => void };
}) {
  return (
    <SafeAreaView style={styles.message}>
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageText}>{text}</Text>
      {action ? <Button title={action.title} onPress={action.onPress} /> : null}
      {secondary ? <Button title={secondary.title} onPress={secondary.onPress} variant="secondary" /> : null}
      <Button title="Назад" onPress={() => router.back()} variant="secondary" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.m,
  },
  topText: { color: '#fff', fontSize: 19, fontFamily: fonts.body, paddingTop: spacing.s },
  topButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  guideWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  guide: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', borderRadius: 16 },
  bottom: { flex: 1, justifyContent: 'space-evenly', paddingHorizontal: spacing.l },
  hint: { color: '#fff', textAlign: 'center', fontSize: 18, fontFamily: fonts.body },
  step: { color: '#B9D3BF', textAlign: 'center', fontSize: 15, fontFamily: fonts.body, marginBottom: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideButton: { width: 80, minHeight: 48, alignItems: 'center', gap: 4 },
  sideText: { color: '#fff', fontSize: 18, fontFamily: fonts.body },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: colors.primary },
  message: { flex: 1, padding: spacing.xl, gap: spacing.l, justifyContent: 'center', backgroundColor: colors.bg },
  messageTitle: { fontSize: 26, fontFamily: fonts.display, color: colors.text },
  messageText: { fontSize: 19, fontFamily: fonts.body, lineHeight: 28, color: colors.text },
});
