import { router } from 'expo-router';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { EDIBILITY_LABEL, type Edibility, type Species } from '../data/types';
import { SPECIES_PHOTOS } from '../data/speciesPhotos';
import { formatSeason, formatSeasonPart } from '../data/season';
import { Icon, type IconName } from './Icon';
import { fonts, colors, edibilityColors, radius, spacing } from './theme';

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

/**
 * Запись определителя: слева цветной «язычок» съедобности — как вырубки на краю страниц
 * в бумажном определителе, видно даже краем глаза.
 */
export function SpeciesRow({ species, right, expanded = false }: { species: Species; right?: ReactNode; expanded?: boolean }) {
  const tint = edibilityColors[species.edibility];
  const photo = SPECIES_PHOTOS[species.id];
  return (
    <Pressable onPress={() => router.push({ pathname: '/species/[id]', params: { id: species.id } })} accessibilityRole="button" accessibilityLabel={`${species.nameRu}, ${EDIBILITY_LABEL[species.edibility]}`} style={({ pressed }) => [styles.row, expanded && styles.expandedRow, pressed && styles.pressed]}>
      <View style={[styles.tab, { backgroundColor: tint.fg }]} />
      <View style={[styles.rowHeading, expanded && styles.expandedHeading]}>
        <View style={[styles.thumbnail, expanded && styles.largeThumbnail]}>
          {photo ? <Image source={photo} style={[styles.photo, expanded && styles.largePhoto]} contentFit="cover" /> : <Icon name="mushroom" size={36} color={colors.muted} />}
        </View>
        <View style={[styles.rowBody, expanded && styles.expandedBody]}>
          <Text style={styles.rowTitle}>{species.nameRu}</Text>
          <Text style={styles.rowSub}>{species.latin}</Text>
          <Text style={[styles.rowEdibility, { color: tint.fg }]}>{EDIBILITY_LABEL[species.edibility]}</Text>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
        {!expanded ? <Icon name="chevron" size={22} color={colors.muted} /> : null}
      </View>
      {expanded ? <View style={styles.summary}>
        <Text style={styles.summaryText}><Text style={styles.summaryLabel}>Когда: </Text>{formatSeason(species.season)}, {formatSeasonPart(species.season)}</Text>
        <Text style={styles.summaryText}><Text style={styles.summaryLabel}>Где искать: </Text>{species.habitat}</Text>
        <Text style={styles.summaryText}><Text style={styles.summaryLabel}>В России: </Text>{species.range}</Text>
        <Text style={styles.openHint}>Открыть признаки и опасных двойников</Text>
      </View> : null}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={styles.sectionTitle}>{children}</Text>;
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
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  icon?: IconName;
}) {
  const primary = variant !== 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      {icon ? <Icon name={icon} size={24} color={primary ? colors.primaryText : colors.primary} /> : null}
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
    paddingVertical: 3,
    marginTop: 8,
    maxWidth: '100%',
    borderRadius: radius.s,
  },
  badgeLarge: { paddingHorizontal: spacing.m, paddingVertical: spacing.xs },
  badgeText: { fontSize: 15, fontFamily: fonts.semibold, lineHeight: 21 },
  badgeTextLarge: { fontSize: 19, fontFamily: fonts.semibold, lineHeight: 27 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.m },
  row: {
    paddingLeft: spacing.l + 6,
    paddingRight: spacing.m,
    paddingVertical: 14,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 },
  rowHeading: { flexDirection: 'row', alignItems: 'center' },
  expandedRow: { marginHorizontal: 16, marginBottom: 16, borderRadius: radius.l, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 18, paddingLeft: 24 },
  expandedHeading: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  expandedBody: { flex: 0 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 22, fontFamily: fonts.display, lineHeight: 28, color: colors.text },
  rowSub: { fontSize: 16, fontFamily: fonts.italic, lineHeight: 22, color: colors.muted, marginTop: 1 },
  rowEdibility: { fontSize: 15, fontFamily: fonts.semibold, lineHeight: 21, marginTop: 4 },
  pressed: { opacity: 0.6 },
  thumbnail: { width: 64, height: 72, borderRadius: radius.s, backgroundColor: colors.sage, marginRight: spacing.m, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  photo: { width: 64, height: 72 },
  largeThumbnail: { width: '100%', height: 180, marginRight: 0, marginBottom: 4, borderRadius: radius.m },
  largePhoto: { width: '100%', height: 180 },
  summary: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 10 },
  summaryText: { fontSize: 18, fontFamily: fonts.body, lineHeight: 27, color: colors.text },
  summaryLabel: { fontFamily: fonts.semibold },
  openHint: { fontSize: 17, fontFamily: fonts.semibold, lineHeight: 25, color: colors.moss, marginTop: 4 },
  right: { alignSelf: 'flex-start', marginTop: 6 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.m,
    padding: spacing.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 23,
    lineHeight: 30,
    fontFamily: fonts.display,
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.s,
  },
  button: {
    minHeight: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: spacing.l,
    borderRadius: radius.m,
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonDanger: { backgroundColor: colors.danger },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  buttonText: { flexShrink: 1, fontSize: 19, fontFamily: fonts.semibold, lineHeight: 26, textAlign: 'center' },
});
