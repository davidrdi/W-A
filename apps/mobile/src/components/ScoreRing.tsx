import type { ScoreBand, Sport } from "@w-a/shared";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, SvgXml } from "react-native-svg";

import { SCORE_BAND_COLOR, SPORT_ICON_SVG } from "../mapIcons";

interface Props {
  sport: Sport;
  score: number;
  scoreBand: ScoreBand;
  active?: boolean;
  onPress?: () => void;
  size?: number;
}

const TRACK_COLOR = "#E6ECE3";

// Anillo de progreso: 100% = aro completo en verde (el deporte recomendado
// ahí ahora mismo), y va "vaciándose" según baja el score — el icono del
// deporte va dentro, sobre un fondo del mismo color que el aro.
export function ScoreRing({ sport, score, scoreBand, active, onPress, size = 52 }: Props) {
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  const color = SCORE_BAND_COLOR[scoreBand];

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={TRACK_COLOR} strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={[styles.iconWrap, { width: size, height: size }]}>
          <View style={[styles.iconBadge, { backgroundColor: color, width: size - 16, height: size - 16, borderRadius: (size - 16) / 2 }]}>
            <SvgXml xml={SPORT_ICON_SVG[sport]} width={16} height={16} />
          </View>
        </View>
      </View>
      <View style={[styles.activeDot, { opacity: active ? 1 : 0 }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 4,
  },
  iconWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadge: {
    alignItems: "center",
    justifyContent: "center",
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#235C4D",
  },
});
