import { router } from 'expo-router';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { EDIBILITY_LABEL, type Edibility, type Species } from '../data/types';
import { SPECIES_PHOTOS } from '../data/speciesPhotos';
import { formatSeason, formatSeasonPart } from '../data/season';
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

export function SpeciesRow({ species, right, expanded = false }: { species: Species; right?: ReactNode; expanded?: boolean }) {
  return (
      <Pressable onPress={() => router.push({ pathname: '/species/[id]', params: { id: species.id } })} accessibilityRole="button" accessibilityLabel={`${species.nameRu}, ${EDIBILITY_LABEL[species.edibility]}`} style={({ pressed }) => [styles.row, expanded && styles.expandedRow, pressed && styles.pressed]}>
        <View style={[styles.rowHeading, expanded && styles.expandedHeading]}>
        <View style={[styles.thumbnail, expanded && styles.largeThumbnail]}>
          {SPECIES_PHOTOS[species.id] ? <Image source={SPECIES_PHOTOS[species.id]} style={[styles.photo, expanded && styles.largePhoto]} contentFit="cover" /> : <Icon name="mushroom" size={40} />}
          <View style={[styles.statusDot, { backgroundColor: edibilityColors[species.edibility].fg }]} />
        </View>
        <View style={[styles.rowBody, expanded && styles.expandedBody]}>
          <Text style={styles.rowTitle}>{species.nameRu}</Text>
          <Text style={styles.rowSub}>{species.latin}</Text>
          <EdibilityBadge edibility={species.edibility} />
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
        {!expanded ? <Icon name="chevron" size={22} color={colors.muted} /> : null}
        </View>
        {expanded ? <View style={styles.summary}>
          <Text style={styles.summaryText}><Text style={styles.summaryLabel}>Когда: </Text>{formatSeason(species.season)} · {formatSeasonPart(species.season)}</Text>
          <Text style={styles.summaryText}><Text style={styles.summaryLabel}>Где искать: </Text>{species.habitat}</Text>
          <Text style={styles.summaryText}><Text style={styles.summaryLabel}>В России: </Text>{species.range}</Text>
          <Text style={styles.openHint}>Признаки и опасные двойники →</Text>
        </View> : null}
      </Pressable>
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
    paddingVertical: 5,
    marginTop: 8,
    maxWidth: '100%',
    borderRadius: radius.s,
  },
  badgeLarge: { paddingHorizontal: spacing.m, paddingVertical: spacing.xs },
  badgeText: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  badgeTextLarge: { fontSize: 20, lineHeight: 28 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.m },
  row: {
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.l,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowHeading: { flexDirection: 'row', alignItems: 'center' },
  expandedRow: { marginHorizontal: 16, marginBottom: 16, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18 },
  expandedHeading: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  expandedBody: { flex: 0 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 23, lineHeight: 29, color: colors.text, fontWeight: '700' },
  rowSub: { fontSize: 17, lineHeight: 24, color: colors.muted, marginTop: 4 },
  chevron: { fontSize: 26, color: colors.muted, marginLeft: spacing.s },
  pressed: { opacity: 0.6 },
  thumbnail: { width: 68, height: 76, borderRadius: 16, backgroundColor: colors.sage, marginRight: spacing.m, justifyContent: 'center', alignItems: 'center' },
  photo: { width: 68, height: 76, borderRadius: 16 },
  largeThumbnail: { width: '100%', height: 180, marginRight: 0, marginBottom: 4 },
  largePhoto: { width: '100%', height: 180 },
  summary: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: colors.border, gap: 10 },
  summaryText: { fontSize: 18, lineHeight: 27, color: colors.text },
  summaryLabel: { fontWeight: '700' },
  openHint: { fontSize: 17, lineHeight: 25, color: colors.primary, fontWeight: '700', marginTop: 4 },
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
    fontSize: 18,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xl,
    marginBottom: spacing.s,
  },
  button: {
    minHeight: 68,
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
  buttonText: { flexShrink: 1, fontSize: 21, lineHeight: 29, textAlign: 'center', fontWeight: '700' },
});
