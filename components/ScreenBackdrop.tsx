import { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ScreenBackdropProps {
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * Purely decorative — corner blobs, a dot grid, and one big faint icon, all
 * drawn from the current accent color so they never fall out of sync with a
 * theme or color switch the way a baked PNG would. Every shape sits behind
 * the real screen content (this is the first child, painted first) and is
 * kept low-opacity enough to read as texture, not something competing for
 * attention with the actual data on screen.
 */
export default function ScreenBackdrop({ icon }: ScreenBackdropProps) {
  const { colors } = useTheme();

  const dots = useMemo(() => {
    const points: { x: number; y: number }[] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        points.push({ x: col * 18, y: row * 18 });
      }
    }
    return points;
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
        <Circle cx={-30} cy={-10} r={110} fill={colors.primary} opacity={0.08} />
        <Circle
          cx={SCREEN_WIDTH * 0.15}
          cy={SCREEN_HEIGHT + 30}
          r={170}
          fill={colors.primary}
          opacity={0.07}
        />
        <Circle
          cx={SCREEN_WIDTH * 0.9}
          cy={SCREEN_HEIGHT + 10}
          r={130}
          fill={colors.primary}
          opacity={0.05}
        />
        {dots.map((d) => (
          <Circle
            key={`${d.x}-${d.y}`}
            cx={SCREEN_WIDTH - 90 + d.x}
            cy={110 + d.y}
            r={2}
            fill={colors.primary}
            opacity={0.18}
          />
        ))}
      </Svg>
      <Ionicons
        name={icon}
        size={230}
        color={colors.primary}
        style={styles.icon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.14,
    right: -40,
    opacity: 0.06,
  },
});
