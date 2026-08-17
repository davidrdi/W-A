import type { ScoreBand, Sport } from "@w-a/shared";
import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";

import { SCORE_BAND_COLOR, SPORT_ICON_SVG } from "../mapIcons";

interface Props {
  sport: Sport;
  scoreBand: ScoreBand;
}

// Pin en forma de lágrima (border-radius 50% 50% 50% 0 + rotate -45deg),
// igual que los marcadores de eventos de Trebo — solo que aquí el color
// codifica el score de la zona, no el deporte (el deporte lo dice el icono).
export function SportPin({ sport, scoreBand }: Props) {
  const svg = SPORT_ICON_SVG[sport];
  const color = SCORE_BAND_COLOR[scoreBand];

  return (
    <View style={styles.outer}>
      <View style={[styles.teardrop, { backgroundColor: color }]}>
        <View style={styles.iconWrap}>
          <SvgXml xml={svg} width={14} height={14} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  teardrop: {
    width: 26,
    height: 26,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    borderBottomRightRadius: 13,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: "-45deg" }],
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  iconWrap: {
    transform: [{ rotate: "45deg" }],
  },
});
