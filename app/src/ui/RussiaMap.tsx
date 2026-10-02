import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import outline from '../data/russia-map.json';
import { clusterRecords, MAP_AREAS, type MapArea, type MapCluster, type MapRecord, type MapRegion } from '../data/mushroomMap';
import { colors } from './theme';

export function RussiaMap({ records, area, selected, onSelect, regions = [], highlighted = [], approximate = false, focusRegion, onRegionSelect }: { records: MapRecord[]; area: MapArea; selected?: string; onSelect: (cluster: MapCluster) => void; regions?: MapRegion[]; highlighted?: string[]; approximate?: boolean; focusRegion?: MapRegion; onRegionSelect?: (id: string) => void }) {
  const [width, setWidth] = useState(320);
  const bounds = MAP_AREAS.find((a) => a.id === area)!;
  const left = (bounds.minLon - 19) / 172 * 1000;
  const right = (bounds.maxLon - 19) / 172 * 1000;
  const local = area === 'kmv' || area === 'kcr';
  const top = (82 - (bounds.maxLat ?? 82)) / 41 * 480;
  const bottom = (82 - (bounds.minLat ?? 41)) / 41 * 480;
  const margin = local ? 0.5 : 20;
  const areaBox = { x: left - margin, y: local ? top - margin : area === 'all' ? -10 : 130, w: right - left + margin * 2, h: local ? bottom - top + margin * 2 : area === 'all' ? 500 : 355 };
  const rb = focusRegion?.bounds;
  const box = rb ? { x: rb[0]! - 2, y: rb[1]! - 2, w: rb[2]! - rb[0]! + 4, h: rb[3]! - rb[1]! + 4 } : areaBox;
  const scale = Math.min(width / box.w, 300 / box.h);
  const clusters = useMemo(() => clusterRecords(records, 52 / scale), [records, scale]);
  return <View style={styles.frame} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
    <Svg width="100%" height={300} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} accessibilityLabel={approximate ? "Примерные регионы произрастания по литературным данным" : "Карта документированных находок грибов в России"}>
      {outline.paths.map((d, i) => <Path key={i} d={d} fill={colors.sage} stroke="#A0B49A" strokeWidth={1 / scale} />)}
      {regions.flatMap((r) => r.paths.map((d, i) => <Path key={`${r.id}:${i}`} d={d} onPress={onRegionSelect ? () => onRegionSelect(r.id) : undefined} fill={highlighted.includes(r.id) ? '#D8AC72' : '#E6EBDF'} stroke="#8A9C7E" strokeWidth={0.7 / scale} />))}
    </Svg>
    {focusRegion || local ? <View pointerEvents="none" style={styles.mapLabel}><Text style={styles.mapLabelText}>{focusRegion?.name ?? bounds.name} · приближение</Text></View> : null}
    {clusters.map((cluster) => <Pressable key={cluster.id} accessibilityRole="button" accessibilityLabel={`Находок: ${cluster.records.length}. Показать записи`} accessibilityState={{ selected: selected === cluster.id }} onPress={() => onSelect(cluster)} style={[styles.marker, {
      left: (cluster.x - box.x) * scale + (width - box.w * scale) / 2 - 24,
      top: (cluster.y - box.y) * scale + (300 - box.h * scale) / 2 - 24,
    }]}>
      <View style={[styles.dot, selected === cluster.id && { backgroundColor: colors.accent }]}><Text style={styles.count}>{cluster.records.length}</Text></View>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  frame: { backgroundColor: '#F0F3EB', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  mapLabel: { position: 'absolute', top: 12, left: 12, right: 12, alignItems: 'flex-start' },
  mapLabelText: { padding: 8, borderRadius: 12, backgroundColor: colors.card, color: colors.text, fontSize: 17, fontWeight: '600' },
  marker: { position: 'absolute', width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  dot: { minWidth: 36, height: 36, paddingHorizontal: 5, borderRadius: 18, borderWidth: 2, borderColor: colors.card, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  count: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
