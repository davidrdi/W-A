"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { LatLon, ScoredSpot, Sport } from "@w-a/shared";
import { SPORT_LABEL, distanceKm, formatDistanceKm } from "@w-a/shared";

import { fetchOverview, fetchSpots } from "../lib/api";
import { ScoreLegend } from "./ScoreLegend";
import { SpotDetailPanel } from "./SpotDetailPanel";
import type { MapSpot } from "./map/MapView";

const MapView = dynamic(() => import("./map/MapView"), { ssr: false });

const SPORTS: Sport[] = ["running", "paseo", "senderismo", "bici", "playa", "surf", "windsurf"];
const SPAIN_CENTER: LatLon = { lat: 40.2, lon: -3.7 };

// "overview" = un pin por zona precalculada de todo el país, sin buscar nada
// (lo que se ve al elegir deporte). "search" = resultado de una localidad
// concreta, con datos reales de OSM cuando responde. Cambiar de deporte
// respeta el modo en el que ya estás: si nunca has buscado, sigue enseñando
// el país entero; si ya buscaste una localidad, refresca esa misma localidad
// para el nuevo deporte en vez de sacarte de ella.
type ViewState =
  | { kind: "overview"; status: "loading" }
  | { kind: "overview"; status: "error"; message: string }
  | { kind: "overview"; status: "done" }
  | { kind: "search"; status: "loading" }
  | { kind: "search"; status: "error"; message: string }
  | { kind: "search"; status: "done"; locality: string; source: "db" | "osm" | "seed" };

// Nominatim devuelve el nombre completo ("A Coruña, Galicia, España, 15001"),
// demasiado largo para una línea de resumen.
function shortLocality(displayName: string): string {
  return displayName.split(",").slice(0, 2).join(",").trim();
}

export function MapaTab() {
  const [sport, setSport] = useState<Sport>("running");
  const [localityInput, setLocalityInput] = useState("A Coruña");
  // Última localidad buscada con éxito; null = modo vista general.
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [spots, setSpots] = useState<ScoredSpot[]>([]);
  const [localityCenter, setLocalityCenter] = useState<LatLon | null>(null);
  const [state, setState] = useState<ViewState>({ kind: "overview", status: "loading" });
  const [selectedSpot, setSelectedSpot] = useState<ScoredSpot | null>(null);

  const loadOverview = async (forSport: Sport) => {
    setState({ kind: "overview", status: "loading" });
    try {
      const result = await fetchOverview(forSport);
      setSpots(result.spots);
      setLocalityCenter(null);
      setState({ kind: "overview", status: "done" });
    } catch (error) {
      setState({ kind: "overview", status: "error", message: error instanceof Error ? error.message : "No se pudo cargar" });
    }
  };

  const loadSearch = async (forSport: Sport, query: string) => {
    setState({ kind: "search", status: "loading" });
    try {
      const result = await fetchSpots(forSport, query);
      setSpots(result.spots);
      setLocalityCenter(result.localityCenter);
      setActiveQuery(query);
      setState({ kind: "search", status: "done", locality: result.locality, source: result.source });
    } catch (error) {
      setState({ kind: "search", status: "error", message: error instanceof Error ? error.message : "No se pudo buscar" });
    }
  };

  // Vista general al entrar, sin que el usuario tenga que pulsar nada.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadOverview(sport);
  }, []);

  const pickSport = (next: Sport) => {
    setSport(next);
    if (activeQuery) {
      loadSearch(next, activeQuery);
    } else {
      loadOverview(next);
    }
  };

  const search = () => {
    if (!localityInput.trim()) return;
    loadSearch(sport, localityInput.trim());
  };

  const backToOverview = () => {
    setActiveQuery(null);
    loadOverview(sport);
  };

  const mapSpots: MapSpot[] = spots.map((s) => ({
    id: s.id,
    lat: s.lat,
    lon: s.lon,
    sport: s.sport,
    scoreBand: s.scoreBand,
    name: s.name,
    description: `Puntuación ${s.score}/100`,
    windDirectionDeg: s.windDirectionDeg,
    windAvgKmh: s.windAvgKmh,
  }));

  const selectedDistanceLabel =
    selectedSpot && localityCenter
      ? formatDistanceKm(distanceKm(localityCenter, { lat: selectedSpot.lat, lon: selectedSpot.lon }))
      : undefined;

  const isSearchMode = state.kind === "search";

  return (
    <div className="relative flex-1">
      <div className="absolute inset-0">
        <MapView
          spots={mapSpots}
          center={localityCenter ?? SPAIN_CENTER}
          zoom={localityCenter ? 12 : 6}
          fitToSpots={isSearchMode && state.status === "done" && spots.length > 0}
          onSelectSpot={(id) => setSelectedSpot(spots.find((s) => s.id === id) ?? null)}
        />
      </div>

      {spots.length > 0 && (
        <div className="absolute left-3 top-3 z-10 rounded-lg border border-white/60 bg-white/80 px-3 py-2 shadow-lg backdrop-blur-md md:bottom-4 md:top-auto">
          <ScoreLegend />
        </div>
      )}

      {/* Panel flotante compacto (no barra a todo lo ancho) para tapar el
          mínimo mapa posible: bottom-sheet en móvil, tarjeta arriba a la
          derecha en desktop (así no choca con los controles +/- de Leaflet,
          que viven arriba a la izquierda). */}
      <div className="absolute inset-x-3 bottom-3 top-auto z-10 flex max-h-[45vh] flex-col gap-2 overflow-y-auto rounded-xl border border-white/60 bg-white/80 p-3 shadow-lg backdrop-blur-md md:inset-x-auto md:top-3 md:bottom-auto md:right-3 md:max-h-none md:w-80">
        <div className="flex flex-wrap gap-1.5">
          {SPORTS.map((s) => (
            <button
              key={s}
              onClick={() => pickSport(s)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold backdrop-blur-sm transition-colors ${
                s === sport
                  ? "border-primary/60 bg-primary/90 text-white shadow"
                  : "border-white/60 bg-white/60 text-textPrimary hover:bg-white/90"
              }`}
            >
              {SPORT_LABEL[s]}
            </button>
          ))}
        </div>
        <input
          className="rounded-lg border border-white/60 bg-white/70 px-3 py-2 text-sm backdrop-blur-sm placeholder:text-textSecondary"
          value={localityInput}
          onChange={(e) => setLocalityInput(e.target.value)}
          placeholder="Localidad (ej. A Coruña)"
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button
          className="rounded-lg border border-primary/60 bg-primary/90 px-4 py-2 text-sm font-semibold text-white shadow backdrop-blur-sm disabled:opacity-50"
          onClick={search}
          disabled={state.status === "loading"}
        >
          {state.status === "loading" && isSearchMode
            ? "Buscando…"
            : `Buscar zonas de ${SPORT_LABEL[sport].toLowerCase()}`}
        </button>

        {state.kind === "overview" && state.status === "loading" && (
          <p className="text-sm text-textSecondary">Cargando vista general…</p>
        )}
        {state.kind === "overview" && state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
        {state.kind === "overview" && state.status === "done" && (
          <p className="text-sm text-textSecondary">
            Vista general: {spots.length} {spots.length === 1 ? "zona" : "zonas"} en toda España. Busca una localidad
            para ver el detalle completo.
          </p>
        )}

        {state.kind === "search" && state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
        {state.kind === "search" && state.status === "done" && (
          <>
            {spots.length === 0 ? (
              <p className="text-sm text-textSecondary">
                No se encontraron zonas de {SPORT_LABEL[sport].toLowerCase()} en esa localidad.
              </p>
            ) : (
              // Resumen explícito de la última búsqueda: sin él, "no veo pines"
              // no se distingue de "no he llegado a buscar".
              <p className="text-sm text-textSecondary">
                {spots.length} {spots.length === 1 ? "zona" : "zonas"} en {shortLocality(state.locality)}
                {state.source === "seed" && " · zonas precalculadas (OpenStreetMap no responde ahora mismo)"}
              </p>
            )}
            <button onClick={backToOverview} className="self-start text-sm font-semibold text-primary hover:underline">
              ← Ver todo el país
            </button>
          </>
        )}
      </div>

      <SpotDetailPanel
        spot={selectedSpot}
        distanceLabel={selectedDistanceLabel}
        nearbySpots={spots}
        onClose={() => setSelectedSpot(null)}
      />
    </div>
  );
}
