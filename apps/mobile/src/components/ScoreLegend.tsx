import { StyleSheet, Text, View } from "react-native";

import { SCORE_BAND_COLOR } from "../mapIcons";

const ITEMS: { band: keyof typeof SCORE_BAND_COLOR; label: string }[] = [
  { band: "green", label: "Buenas condiciones" },
  { band: "amber", label: "Regular" },
  { band: "red", label: "Evita hoy" },
];

export function ScoreLegend() {
  return (
    <View style={styles.row}>
      {ITEMS.map((item) => (
        <View key={item.band} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: SCORE_BAND_COLOR[item.band] }]} />
          <Text style={styles.label}>{item.label}</Text>
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
