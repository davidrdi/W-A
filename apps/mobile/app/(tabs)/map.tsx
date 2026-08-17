import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { ScoredSpot } from "@w-a/shared";

import { fetchSpots } from "../../src/api";
import { SportPin } from "../../src/components/SportPin";

const SPAIN_REGION = {
  latitude: 40.2,
  longitude: -3.7,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

type SearchState = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done" };

export default function MapScreen() {
  const [locality, setLocality] = useState("A Coruña");
  const [spots, setSpots] = useState<ScoredSpot[]>([]);
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const mapRef = useRef<MapView>(null);

  const search = async () => {
    if (!locality.trim()) return;
    setState({ kind: "loading" });
    try {
      const result = await fetchSpots("running", locality.trim());
      setSpots(result.spots);
      setState({ kind: "done" });

      if (result.spots.length > 0) {
        mapRef.current?.fitToCoordinates(
          result.spots.map((s) => ({ latitude: s.lat, longitude: s.lon })),
          { edgePadding: { top: 80, right: 60, bottom: 80, left: 60 }, animated: true },
        );
      }
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "No se pudo buscar" });
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <MapView ref={mapRef} style={styles.map} initialRegion={SPAIN_REGION}>
        {spots.map((spot) => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.lat, longitude: spot.lon }}
            title={spot.name}
            description={`Puntuación ${spot.score}/100`}
            tracksViewChanges={false}
          >
            <SportPin sport={spot.sport} scoreBand={spot.scoreBand} />
          </Marker>
        ))}
      </MapView>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={locality}
          onChangeText={setLocality}
          placeholder="Localidad (ej. A Coruña)"
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <Pressable style={styles.button} onPress={search} disabled={state.kind === "loading"}>
          {state.kind === "loading" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Buscar zonas de running</Text>
          )}
        </Pressable>
        {state.kind === "error" && <Text style={styles.error}>{state.message}</Text>}
        {state.kind === "done" && spots.length === 0 && (
          <Text style={styles.hint}>No se encontraron zonas de running en esa localidad.</Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  searchBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D3DCCE",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  button: {
    backgroundColor: "#235C4D",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  error: {
    color: "#B4432E",
    fontSize: 13,
  },
  hint: {
    color: "#52625A",
    fontSize: 13,
  },
});
