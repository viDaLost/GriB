import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors } from './theme';

export type IconName = 'mushroom' | 'camera' | 'book' | 'sliders' | 'shield' | 'leaf' | 'search' | 'gallery' | 'plus' | 'close' | 'chevron' | 'check' | 'drop' | 'phone' | 'arrow' | 'map' | 'calendar' | 'more';

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
        {name === 'map' && <><Path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16" /></>}
        {name === 'calendar' && <><Rect x={3} y={5} width={18} height={16} rx={3} /><Path d="M7 3v4M17 3v4M3 10h18M7 14h2m4 0h2m-8 3h2" /></>}
        {name === 'more' && <><Circle cx={5} cy={12} r={1} /><Circle cx={12} cy={12} r={1} /><Circle cx={19} cy={12} r={1} /></>}
      </G>
    </Svg>
  );
}
