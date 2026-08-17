import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchHealth } from "../../src/api";

type Status = { kind: "loading" } | { kind: "ok"; message: string } | { kind: "error"; message: string };

export default function HomeScreen() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const check = useCallback(async () => {
    try {
      const health = await fetchHealth();
      setStatus({ kind: "ok", message: `Backend OK (${health.service}, ${health.status})` });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "No se pudo conectar con el backend",
      });
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await check();
    setRefreshing(false);
  }, [check]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>W-A</Text>
      <Text style={styles.subtitle}>Recomendación de zonas por deporte y tiempo</Text>

      <View style={styles.statusCard}>
        {status.kind === "loading" && <ActivityIndicator />}
        {status.kind !== "loading" && (
          <Text style={status.kind === "ok" ? styles.ok : styles.error}>{status.message}</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
  },
  statusCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F2F4F1",
  },
  ok: {
    color: "#235C4D",
    fontWeight: "600",
  },
  error: {
    color: "#B4432E",
    fontWeight: "600",
  },
});
