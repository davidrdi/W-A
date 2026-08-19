import { StyleSheet, Text, View } from "react-native";

import { SCORE_BAND_COLOR, SCORE_BAND_LABEL } from "../mapIcons";

const BANDS: (keyof typeof SCORE_BAND_COLOR)[] = ["green", "yellow", "orange", "red"];

export function ScoreLegend() {
  return (
    <View style={styles.row}>
      {BANDS.map((band) => (
        <View key={band} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: SCORE_BAND_COLOR[band] }]} />
          <Text style={styles.label}>{SCORE_BAND_LABEL[band]}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  label: {
    fontSize: 12,
    color: "#52625A",
  },
});
