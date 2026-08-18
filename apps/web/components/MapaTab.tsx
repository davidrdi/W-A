"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { LatLon, ScoredSpot, Sport } from "@w-a/shared";
import { SPORT_LABEL, distanceKm, formatDistanceKm } from "@w-a/shared";

import { fetchSpots } from "../lib/api";
import { ScoreLegend } from "./ScoreLegend";
import { SpotDetailPanel } from "./SpotDetailPanel";
import type { MapSpot } from "./map/MapView";

const MapView = dynamic(() => import("./map/MapView"), { ssr: false });

const SPORTS: Sport[] = ["running", "paseo", "senderismo", "bici", "playa", "surf", "windsurf"];
const SPAIN_CENTER: LatLon = { lat: 40.2, lon: -3.7 };

type SearchState = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done" };

export function MapaTab() {
  const [sport, setSport] = useState<Sport>("running");
  const [locality, setLocality] = useState("A Coruña");
  const [spots, setSpots] = useState<ScoredSpot[]>([]);
  const [localityCenter, setLocalityCenter] = useState<LatLon | null>(null);
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [selectedSpot, setSelectedSpot] = useState<ScoredSpot | null>(null);

  const search = async () => {
    if (!locality.trim()) return;
    setState({ kind: "loading" });
    try {
      const result = await fetchSpots(sport, locality.trim());
      setSpots(result.spots);
      setLocalityCenter(result.localityCenter);
      setState({ kind: "done" });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "No se pudo buscar" });
    }
  };

  const mapSpots: MapSpot[] = spots.map((s) => ({
    id: s.id,
    lat: s.lat,
    lon: s.lon,
    sport: s.sport,
    scoreBand: s.scoreBand,
    name: s.name,
    description: `Puntuación ${s.score}/100`,
  }));

  const selectedDistanceLabel =
    selectedSpot && localityCenter
      ? formatDistanceKm(distanceKm(localityCenter, { lat: selectedSpot.lat, lon: selectedSpot.lon }))
      : undefined;

  return (
    <div className="relative flex-1">
      <div className="absolute inset-0">
        <MapView
          spots={mapSpots}
          center={localityCenter ?? SPAIN_CENTER}
          zoom={localityCenter ? 12 : 6}
          fitToSpots={state.kind === "done" && spots.length > 0}
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
              onClick={() => setSport(s)}
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
          value={locality}
          onChange={(e) => setLocality(e.target.value)}
          placeholder="Localidad (ej. A Coruña)"
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button
          className="rounded-lg border border-primary/60 bg-primary/90 px-4 py-2 text-sm font-semibold text-white shadow backdrop-blur-sm disabled:opacity-50"
          onClick={search}
          disabled={state.kind === "loading"}
        >
          {state.kind === "loading" ? "Buscando…" : `Buscar zonas de ${SPORT_LABEL[sport].toLowerCase()}`}
        </button>
        {state.kind === "error" && <p className="text-sm text-danger">{state.message}</p>}
        {state.kind === "done" && spots.length === 0 && (
          <p className="text-sm text-textSecondary">
            No se encontraron zonas de {SPORT_LABEL[sport].toLowerCase()} en esa localidad.
          </p>
        )}
      </div>

      <SpotDetailPanel spot={selectedSpot} distanceLabel={selectedDistanceLabel} onClose={() => setSelectedSpot(null)} />
    </div>
  );
}
