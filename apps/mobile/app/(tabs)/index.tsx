import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import type { LatLon, QueryResponse, RankedSpot } from "@w-a/shared";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";

import { submitQuery } from "../../src/api";
import { ScoreLegend } from "../../src/components/ScoreLegend";
import { SpotDetailModal } from "../../src/components/SpotDetailModal";
import { SportPin } from "../../src/components/SportPin";
import { distanceKm, formatDistanceKm } from "../../src/distance";
import { SCORE_BAND_COLOR } from "../../src/mapIcons";

const EXAMPLES = ["Playa en el sur de Galicia", "Quiero correr en Coruña sin hacer trail", "Senderismo cerca de Sevilla"];

type State = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done" };

export default function QueryScreen() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [selectedSpot, setSelectedSpot] = useState<RankedSpot | null>(null);
  const [userLocation, setUserLocation] = useState<LatLon | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const position = await Location.getCurrentPositionAsync({});
      setUserLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
    })();
  }, []);

  const distanceReference = userLocation ?? result?.localityCenter ?? null;

  const search = async () => {
    if (text.trim().length < 3) return;
    setState({ kind: "loading" });
    try {
      const response = await submitQuery(text.trim());
      setResult(response);
      setState({ kind: "done" });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "No se pudo interpretar la petición" });
    }
  };

  const selectedSpotDistanceLabel = useMemo(() => {
    if (!selectedSpot || !distanceReference) return undefined;
    return formatDistanceKm(distanceKm(distanceReference, { lat: selectedSpot.lat, lon: selectedSpot.lon }));
  }, [selectedSpot, distanceReference]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>¿Dónde y qué te apetece hacer?</Text>
        <Text style={styles.subtitle}>Escribe en lenguaje natural, como se lo pedirías a un amigo.</Text>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Ej. playa en el sur de Galicia"
          onSubmitEditing={search}
          returnKeyType="search"
          multiline
        />

        {state.kind !== "loading" && (
          <View style={styles.examplesRow}>
            {EXAMPLES.map((example) => (
              <Pressable key={example} style={styles.exampleChip} onPress={() => setText(example)}>
                <Text style={styles.exampleChipText}>{example}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable style={styles.button} onPress={search} disabled={state.kind === "loading"}>
          {state.kind === "loading" ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Buscar</Text>}
        </Pressable>

        {state.kind === "error" && <Text style={styles.error}>{state.message}</Text>}

        {state.kind === "done" && result && (
          <>
            <Text style={styles.resultHeader}>
              {result.spots.length > 0
                ? `${result.intent.sport} en ${result.locality}`
                : `Sin resultados en ${result.locality} con esos filtros`}
            </Text>

            {result.spots.length > 0 && (
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: result.localityCenter.lat,
                  longitude: result.localityCenter.lon,
                  latitudeDelta: 0.15,
                  longitudeDelta: 0.15,
                }}
              >
                {result.spots.map((spot) => (
                  <Marker
                    key={spot.id}
                    coordinate={{ latitude: spot.lat, longitude: spot.lon }}
                    title={spot.name}
                    tracksViewChanges={false}
                    onPress={() => setSelectedSpot(spot)}
                  >
                    <SportPin sport={spot.sport} scoreBand={spot.scoreBand} />
                  </Marker>
                ))}
              </MapView>
            )}

            {result.spots.length > 0 && <ScoreLegend />}

            {result.spots.map((spot, index) => {
              const distanceLabel = distanceReference
                ? formatDistanceKm(distanceKm(distanceReference, { lat: spot.lat, lon: spot.lon }))
                : null;
              return (
                <Pressable key={spot.id} style={styles.card} onPress={() => setSelectedSpot(spot)}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.rankBadge, { backgroundColor: SCORE_BAND_COLOR[spot.scoreBand] }]}>
                      <Text style={styles.rankBadgeText}>{index + 1}</Text>
                    </View>
                    <View style={styles.cardTitleBlock}>
                      <Text style={styles.cardName}>{spot.name}</Text>
                      {distanceLabel && <Text style={styles.cardDistance}>A {distanceLabel}</Text>}
                    </View>
                    <Text style={styles.cardScore}>{spot.score}</Text>
                  </View>
                  <Text style={styles.cardHeadline}>{spot.headline}</Text>
                  {spot.reasoning ? <Text style={styles.cardReasoning}>{spot.reasoning}</Text> : null}
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      <SpotDetailModal spot={selectedSpot} distanceLabel={selectedSpotDistanceLabel} onClose={() => setSelectedSpot(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: "#52625A",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D3DCCE",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 50,
  },
  examplesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  exampleChip: {
    backgroundColor: "#F2F4F1",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  exampleChipText: {
    fontSize: 12,
    color: "#17211A",
  },
  button: {
    backgroundColor: "#235C4D",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  error: {
    color: "#B4432E",
  },
  resultHeader: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 8,
    textTransform: "capitalize",
  },
  map: {
    height: 200,
    borderRadius: 12,
  },
  card: {
    backgroundColor: "#F2F4F1",
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  cardTitleBlock: {
    flex: 1,
    gap: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "700",
  },
  cardDistance: {
    fontSize: 12,
    color: "#52625A",
  },
  cardScore: {
    fontSize: 16,
    fontWeight: "700",
    color: "#17211A",
  },
  cardHeadline: {
    fontSize: 14,
    fontWeight: "600",
  },
  cardReasoning: {
    fontSize: 13,
    color: "#333",
  },
});
