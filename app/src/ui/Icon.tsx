import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors } from './theme';

export type IconName = 'mushroom' | 'camera' | 'book' | 'sliders' | 'shield' | 'leaf' | 'search' | 'gallery' | 'plus' | 'close' | 'chevron' | 'check' | 'drop' | 'phone' | 'arrow';

/** Original vector family: the same shapes stay crisp on web, Android and iOS. */
export function Icon({ name, size = 24, color = colors.primary }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <G fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        {name === 'mushroom' && <><Path d="M3 13C3 7.5 7 4 12 4s9 3.5 9 9H3Z" /><Path d="M9.5 13 9 20h6l-.5-7M6.5 9h.1M12 7h.1M17 10h.1" /></>}
        {name === 'camera' && <><Path d="M8 6 9.5 4h5L16 6h4a1 1 0 0 1 1 1v12H3V7a1 1 0 0 1 1-1h4Z" /><Circle cx={12} cy={12} r={3.5} /><Path d="M17.5 9h.1" /></>}
        {name === 'book' && <><Path d="M12 6v15M12 6C9 3.5 5 3.5 2.5 4.5v14C5 17.5 9 18 12 21c3-3 7-3.5 9.5-2.5v-14C19 3.5 15 3.5 12 6Z" /><Path d="M6 8h2M16 8h2M6 12h2M16 12h2" /></>}
        {name === 'sliders' && <><Path d="M4 6h4m5 0h7M4 12h9m5 0h2M4 18h2m5 0h9" /><Circle cx={10.5} cy={6} r={2.5} /><Circle cx={15.5} cy={12} r={2.5} /><Circle cx={8.5} cy={18} r={2.5} /></>}
        {name === 'shield' && <><Path d="m12 3 8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Z" /><Path d="M12 8v5m0 3h.01" /></>}
        {name === 'leaf' && <><Path d="M20 3C9 2 3 7 4 13c1 7 12 8 15 1 1-3 1-7 1-11ZM4 21 15 9M8 17v-5m3 2h5" /></>}
        {name === 'search' && <><Circle cx={10} cy={10} r={6} /><Path d="m15 15 6 6" /></>}
        {name === 'gallery' && <><Rect x={3} y={3} width={18} height={18} rx={4} /><Circle cx={8} cy={8} r={1.5} /><Path d="m3 17 5-5 4 4 4-6 5 7" /></>}
        {name === 'plus' && <Path d="M12 5v14M5 12h14" />}
        {name === 'close' && <Path d="m6 6 12 12M18 6 6 18" />}
        {name === 'chevron' && <Path d="m9 5 7 7-7 7" />}
        {name === 'check' && <Path d="m5 12 4 4L19 6" />}
        {name === 'drop' && <Path d="M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12ZM9 15c0 2 1 3 3 3" />}
        {name === 'phone' && <Path d="m8 3 3 5-3 3c1 2 3 4 5 5l3-3 5 3-1 4C11 23 1 13 4 4l4-1Z" />}
        {name === 'arrow' && <Path d="M4 12h16m-6-6 6 6-6 6" />}
      </G>
    </Svg>
  );
}

/** A small botanical drawing, not a photograph or an identification reference. */
export function ForestArt({ size = 190 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 220 220" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={110} cy={110} r={98} fill="#DFE8D7" />
      <Circle cx={168} cy={44} r={12} fill="#F7F4EC" />
      <G fill="none" stroke="#92AD87" strokeWidth={2} strokeLinecap="round">
        <Path d="M35 165 57 103m-15 43-13-18m18 4 20-9M183 176l-11-54m8 37 14-19m-18 1-13-9" />
        <Path d="M30 186c45-9 111-8 164 0" />
      </G>
      <Path d="m92 105-6 69c9 9 34 9 43-1l-7-68" fill="#F7F4EC" stroke="#234F40" strokeWidth={2} />
      <Path d="M52 113c0-43 28-67 58-67s63 28 63 67c-30 13-88 13-121 0Z" fill="#B75B3D" stroke="#234F40" strokeWidth={2.5} />
      <Path d="M53 113c27 13 89 14 120 0" fill="none" stroke="#E7AF83" strokeWidth={6} />
      <Path d="M74 91c4-10 10-16 19-20" fill="none" stroke="#ECC5A3" strokeWidth={5} strokeLinecap="round" />
      <Circle cx={123} cy={68} r={5} fill="#ECC5A3" /><Circle cx={145} cy={91} r={7} fill="#ECC5A3" />
      <Path d="m143 158-2 26h17l-2-26" fill="#F7F4EC" stroke="#234F40" strokeWidth={2} />
      <Path d="M125 160c1-21 13-31 25-31 16 0 28 13 29 31-16 6-38 6-54 0Z" fill="#D7A65A" stroke="#234F40" strokeWidth={2} />
      <Path d="M74 179c-6-12-17-17-23-16 1 10 10 16 23 16ZM161 187c3-14 12-22 21-22-1 13-9 21-21 22Z" fill="#6E926D" />
    </Svg>
  );
}
