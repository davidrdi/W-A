import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FEATURES = [
  {
    color: "#16a34a",
    title: "Zonas coloreadas por condiciones",
    description: "Verde, ámbar o rojo según la meteo de hoy y la lluvia de ayer — de un vistazo, sin adivinar.",
  },
  {
    color: "#235C4D",
    title: "Elige deporte y localidad",
    description: "Te enseñamos las zonas de esa localidad puntuadas para hoy, y el porqué de cada una.",
  },
  {
    color: "#B8862B",
    title: "Guarda tus favoritos",
    description: "Vuelve rápido a las zonas de siempre desde la pestaña Favoritos.",
  },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Antes de empezar</Text>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.feature}>
              <View style={[styles.dot, { backgroundColor: feature.color }]} />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Pressable style={styles.button} onPress={onDone}>
        <Text style={styles.buttonText}>Empezar</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "space-between",
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  features: {
    gap: 22,
  },
  feature: {
    flexDirection: "row",
    gap: 14,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 5,
  },
  featureText: {
    flex: 1,
    gap: 3,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  featureDescription: {
    fontSize: 14,
    color: "#52625A",
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#235C4D",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
