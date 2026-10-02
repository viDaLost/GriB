import { Link } from 'expo-router';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { EDIBILITY_LABEL, type Edibility, type Species } from '../data/types';
import { SPECIES_PHOTOS } from '../data/speciesPhotos';
import { Icon, type IconName } from './Icon';
import { colors, edibilityColors, radius, spacing } from './theme';

export function EdibilityBadge({ edibility, large }: { edibility: Edibility; large?: boolean }) {
  const c = edibilityColors[edibility];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, large && styles.badgeLarge]}>
      <Text style={[styles.badgeText, { color: c.fg }, large && styles.badgeTextLarge]}>
        {EDIBILITY_LABEL[edibility]}
      </Text>
    </View>
  );
}

/** Цветная метка-кружок в списках — видна даже краем глаза. */
export function EdibilityDot({ edibility }: { edibility: Edibility }) {
  return <View style={[styles.dot, { backgroundColor: edibilityColors[edibility].fg }]} />;
}

export function SpeciesRow({ species, right }: { species: Species; right?: ReactNode }) {
  return (
    <Link href={{ pathname: '/species/[id]', params: { id: species.id } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`${species.nameRu}, ${EDIBILITY_LABEL[species.edibility]}`} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.thumbnail}>
          {SPECIES_PHOTOS[species.id] ? <Image source={SPECIES_PHOTOS[species.id]} style={styles.photo} contentFit="cover" /> : <Icon name="mushroom" size={28} />}
          <View style={[styles.statusDot, { backgroundColor: edibilityColors[species.edibility].fg }]} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{species.nameRu}</Text>
          <Text style={styles.rowSub}>
            {species.latin} · {EDIBILITY_LABEL[species.edibility].toLowerCase()}
          </Text>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
        <Icon name="chevron" size={22} color={colors.muted} />
      </Pressable>
    </Link>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  icon?: IconName;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      {icon ? <Icon name={icon} size={25} color={primary ? colors.primaryText : colors.primary} /> : null}
      <Text style={[styles.buttonText, { color: primary ? colors.primaryText : colors.primary }]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.s,
    paddingVertical: 2,
    borderRadius: radius.s,
  },
  badgeLarge: { paddingHorizontal: spacing.m, paddingVertical: spacing.xs },
  badgeText: { fontSize: 15, fontWeight: '600' },
  badgeTextLarge: { fontSize: 18 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.m },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 19, lineHeight: 25, color: colors.text, fontWeight: '600' },
  rowSub: { fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: 4 },
  chevron: { fontSize: 26, color: colors.muted, marginLeft: spacing.s },
  pressed: { opacity: 0.6 },
  thumbnail: { width: 52, height: 56, borderRadius: 14, backgroundColor: colors.sage, marginRight: spacing.m, justifyContent: 'center', alignItems: 'center' },
  photo: { width: 52, height: 56, borderRadius: 14 },
  statusDot: { position: 'absolute', right: -2, bottom: -2, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: colors.card },
  right: { alignSelf: 'flex-start', marginTop: 8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.m,
    padding: spacing.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xl,
    marginBottom: spacing.s,
  },
  button: {
    minHeight: 62,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: spacing.l,
    borderRadius: radius.m,
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary },
  buttonText: { flexShrink: 1, fontSize: 19, lineHeight: 26, textAlign: 'center', fontWeight: '700' },
});
