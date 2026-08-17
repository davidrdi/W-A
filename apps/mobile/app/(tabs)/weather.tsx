import { useState } from "react";
import type { WeatherResponse } from "@w-a/shared";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { fetchWeather } from "../../src/api";

type State = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };

export default function WeatherScreen() {
  const [locality, setLocality] = useState("A Coruña");
  const [result, setResult] = useState<WeatherResponse | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });

  const search = async () => {
    if (!locality.trim()) return;
    setState({ kind: "loading" });
    try {
      const response = await fetchWeather(locality.trim());
      setResult(response);
      setState({ kind: "ready" });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "No se pudo consultar el tiempo" });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.subtitle}>Consulta general del tiempo — sin recomendación de zona.</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={locality}
          onChangeText={setLocality}
          placeholder="Localidad (ej. A Coruña)"
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <Pressable style={styles.button} onPress={search} disabled={state.kind === "loading"}>
          {state.kind === "loading" ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Ver tiempo</Text>}
        </Pressable>
      </View>

      {state.kind === "error" && <Text style={styles.error}>{state.message}</Text>}

      {state.kind === "ready" && result && (
        <View style={styles.card}>
          <Text style={styles.locality}>{result.locality ?? `${result.lat}, ${result.lon}`}</Text>

          <View style={styles.row}>
            <WeatherStat label="Lluvia ayer" value={`${result.weather.rainYesterdayMm} mm`} />
            <WeatherStat label="Lluvia hoy" value={`${result.weather.rainTodayMm} mm`} />
          </View>
          <View style={styles.row}>
            <WeatherStat label="Viento medio" value={`${result.weather.windAvgTodayKmh} km/h`} />
            <WeatherStat label="Viento máx." value={`${result.weather.windMaxTodayKmh} km/h`} />
          </View>
          <View style={styles.row}>
            <WeatherStat label="Temperatura media" value={`${result.weather.temperatureAvgTodayC}°C`} />
            <WeatherStat label="Dirección viento" value={`${result.weather.windDirectionMiddayDeg}°`} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function WeatherStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },
  subtitle: {
    fontSize: 15,
    color: "#52625A",
  },
  searchRow: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D3DCCE",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  button: {
    backgroundColor: "#235C4D",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  error: {
    color: "#B4432E",
  },
  card: {
    backgroundColor: "#F2F4F1",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  locality: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  stat: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
  },
  statLabel: {
    fontSize: 12,
    color: "#52625A",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#17211A",
    marginTop: 2,
  },
});
