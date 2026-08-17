import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
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
import type { LatLon, ScoredSpot, Sport } from "@w-a/shared";

import { fetchSpots } from "../../src/api";
import { ScoreLegend } from "../../src/components/ScoreLegend";
import { SpotDetailModal } from "../../src/components/SpotDetailModal";
import { SportPin } from "../../src/components/SportPin";
import { distanceKm, formatDistanceKm } from "../../src/distance";
import { SPORT_LABEL } from "../../src/mapIcons";

const SPAIN_REGION = {
  latitude: 40.2,
  longitude: -3.7,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

const SPORTS: Sport[] = ["running", "paseo", "senderismo", "bici", "playa", "surf", "windsurf"];

type SearchState = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done" };

export default function MapScreen() {
  const [sport, setSport] = useState<Sport>("running");
  const [locality, setLocality] = useState("A Coruña");
  const [spots, setSpots] = useState<ScoredSpot[]>([]);
  const [localityCenter, setLocalityCenter] = useState<LatLon | null>(null);
  const [userLocation, setUserLocation] = useState<LatLon | null>(null);
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [selectedSpot, setSelectedSpot] = useState<ScoredSpot | null>(null);
  const mapRef = useRef<MapView>(null);

  // Ubicación real opcional: si el usuario da permiso, las distancias se
  // calculan desde ahí; si no, se usa el centro de la localidad buscada
  // (siempre disponible, sin pedir nada al usuario).
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const position = await Location.getCurrentPositionAsync({});
      setUserLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
    })();
  }, []);

  const distanceReference = userLocation ?? localityCenter;

  const search = async () => {
    if (!locality.trim()) return;
    setState({ kind: "loading" });
    try {
      const result = await fetchSpots(sport, locality.trim());
      setSpots(result.spots);
      setLocalityCenter(result.localityCenter);
      setState({ kind: "done" });

      if (result.spots.length > 0) {
        mapRef.current?.fitToCoordinates(
          result.spots.map((s) => ({ latitude: s.lat, longitude: s.lon })),
          { edgePadding: { top: 130, right: 60, bottom: 80, left: 60 }, animated: true },
        );
      }
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "No se pudo buscar" });
    }
  };

  const selectedSpotDistanceLabel = useMemo(() => {
    if (!selectedSpot || !distanceReference) return undefined;
    return formatDistanceKm(distanceKm(distanceReference, { lat: selectedSpot.lat, lon: selectedSpot.lon }));
  }, [selectedSpot, distanceReference]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <MapView ref={mapRef} style={styles.map} initialRegion={SPAIN_REGION} showsUserLocation={userLocation !== null}>
        {spots.map((spot) => {
          const distanceLabel = distanceReference
            ? formatDistanceKm(distanceKm(distanceReference, { lat: spot.lat, lon: spot.lon }))
            : null;
          return (
            <Marker
              key={spot.id}
              coordinate={{ latitude: spot.lat, longitude: spot.lon }}
              title={spot.name}
              description={`Puntuación ${spot.score}/100${distanceLabel ? ` · a ${distanceLabel}` : ""}`}
              tracksViewChanges={false}
              onPress={() => setSelectedSpot(spot)}
            >
              <SportPin sport={spot.sport} scoreBand={spot.scoreBand} />
            </Marker>
          );
        })}
      </MapView>

      <SpotDetailModal spot={selectedSpot} distanceLabel={selectedSpotDistanceLabel} onClose={() => setSelectedSpot(null)} />

      {spots.length > 0 && (
        <View style={styles.legendCard}>
          <ScoreLegend />
        </View>
      )}

      <View style={styles.searchBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportRow}>
          {SPORTS.map((s) => (
            <Pressable
              key={s}
              style={[styles.sportChip, s === sport && styles.sportChipActive]}
              onPress={() => setSport(s)}
            >
              <Text style={[styles.sportChipText, s === sport && styles.sportChipTextActive]}>{SPORT_LABEL[s]}</Text>
            </Pressable>
          ))}
        </ScrollView>

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
            <Text style={styles.buttonText}>Buscar zonas de {SPORT_LABEL[sport].toLowerCase()}</Text>
          )}
        </Pressable>
        {state.kind === "error" && <Text style={styles.error}>{state.message}</Text>}
        {state.kind === "done" && spots.length === 0 && (
          <Text style={styles.hint}>No se encontraron zonas de {SPORT_LABEL[sport].toLowerCase()} en esa localidad.</Text>
        )}
        {state.kind === "done" && spots.length > 0 && (
          <Text style={styles.hint}>
            Distancias {userLocation ? "desde tu ubicación" : `desde el centro de ${locality.trim()}`}.
          </Text>
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
  legendCard: {
    position: "absolute",
    bottom: 16,
    left: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
  sportRow: {
    gap: 6,
    paddingBottom: 2,
  },
  sportChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F2F4F1",
  },
  sportChipActive: {
    backgroundColor: "#235C4D",
  },
  sportChipText: {
    fontSize: 13,
    color: "#17211A",
    fontWeight: "600",
  },
  sportChipTextActive: {
    color: "#fff",
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
