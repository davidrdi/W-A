"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LatLon, ScoredSpot, ZoneChip, ZoneLevel, ZoneMode } from "@w-a/shared";
import { ZONE_MODE_LABEL } from "@w-a/shared";

import { fetchZoneDetail, fetchZones, type ZonesViewport } from "../lib/api";
import { ScoreLegend } from "./ScoreLegend";
import { SpotDetailPanel } from "./SpotDetailPanel";
import { ZoneDetailPanel, type ZoneDetailState } from "./ZoneDetailPanel";

const ZoneMapView = dynamic(() => import("./map/ZoneMapView"), { ssr: false });

const SPAIN_CENTER: LatLon = { lat: 40.2, lon: -3.7 };
const SPAIN_ZOOM = 6;
// Mover el mapa dispara moveend muchas veces; se espera a que el usuario
// pare antes de pedir zonas (Overpass y Open-Meteo no son gratis).
const VIEWPORT_DEBOUNCE_MS = 400;

const MODES: ZoneMode[] = ["tierra", "mar"];

const LEVEL_HINT: Record<ZoneLevel, string> = {
  provincia: "Una zona por provincia — acerca el mapa para ver municipios.",
  municipio: "Una zona por municipio — acerca más para ver barrios.",
  local: "Una zona por barrio.",
};

type ZonesState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };

export function ZonasTab() {
  const [mode, setMode] = useState<ZoneMode>("tierra");
  const [zones, setZones] = useState<ZoneChip[]>([]);
  const [level, setLevel] = useState<ZoneLevel>("provincia");
  const [state, setState] = useState<ZonesState>({ kind: "loading" });
  const [selectedZone, setSelectedZone] = useState<ZoneChip | null>(null);
  const [detailState, setDetailState] = useState<ZoneDetailState>({ kind: "loading" });
  const [selectedSpot, setSelectedSpot] = useState<ScoredSpot | null>(null);

  const viewportRef = useRef<ZonesViewport | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cada carga lleva número: si el usuario sigue moviendo el mapa, las
  // respuestas que lleguen tarde y fuera de orden se descartan.
  const loadIdRef = useRef(0);

  const load = useCallback(async (nextMode: ZoneMode, viewport: ZonesViewport) => {
    const loadId = ++loadIdRef.current;
    setState({ kind: "loading" });
    try {
      const result = await fetchZones(nextMode, viewport);
      if (loadId !== loadIdRef.current) return;
      setZones(result.zones);
      setLevel(result.level);
      setState({ kind: "ready" });
    } catch (error) {
      if (loadId !== loadIdRef.current) return;
      setState({ kind: "error", message: error instanceof Error ? error.message : "No se pudieron cargar las zonas" });
    }
  }, []);

  const handleViewportChange = useCallback(
    (viewport: ZonesViewport) => {
      viewportRef.current = viewport;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => load(mode, viewport), VIEWPORT_DEBOUNCE_MS);
    },
    [load, mode],
  );

  // Cambiar de modo repite la consulta sobre la vista actual, sin esperar a
  // que el usuario mueva el mapa.
  const changeMode = (nextMode: ZoneMode) => {
    setMode(nextMode);
    setSelectedZone(null);
    if (viewportRef.current) load(nextMode, viewportRef.current);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const openZone = async (zone: ZoneChip) => {
    setSelectedZone(zone);
    setDetailState({ kind: "loading" });
    try {
      const detail = await fetchZoneDetail(zone, mode);
      setDetailState({ kind: "ready", detail });
    } catch (error) {
      setDetailState({
        kind: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar la zona",
      });
    }
  };

  return (
    <div className="relative flex-1">
      <div className="absolute inset-0">
        <ZoneMapView
          zones={zones}
          center={SPAIN_CENTER}
          zoom={SPAIN_ZOOM}
          onViewportChange={handleViewportChange}
          onSelectZone={openZone}
        />
      </div>

      <div className="absolute inset-x-3 top-3 z-[900] flex flex-col gap-2 rounded-xl border border-white/60 bg-white/85 p-3 shadow-lg backdrop-blur-md md:inset-x-auto md:left-1/2 md:w-[26rem] md:-translate-x-1/2">
        <div className="flex gap-1.5">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => changeMode(m)}
              className={`flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                m === mode
                  ? "border-primary/60 bg-primary/90 text-white shadow"
                  : "border-white/60 bg-white/60 text-textPrimary hover:bg-white/90"
              }`}
            >
              {ZONE_MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="text-xs text-textSecondary">
          {state.kind === "loading" ? "Cargando zonas…" : LEVEL_HINT[level]}
        </p>
        {state.kind === "error" && <p className="text-sm text-danger">{state.message}</p>}
        {state.kind === "ready" && zones.length === 0 && (
          <p className="text-sm text-textSecondary">
            {mode === "mar"
              ? "No hay costa en esta vista — mueve el mapa hacia el litoral."
              : "No hay zonas mapeadas en esta vista."}
          </p>
        )}
      </div>

      <div className="absolute bottom-4 left-3 z-[900] rounded-lg border border-white/60 bg-white/80 px-3 py-2 shadow-lg backdrop-blur-md">
        <ScoreLegend />
      </div>

      {selectedZone && (
        <ZoneDetailPanel
          zone={selectedZone}
          mode={mode}
          state={detailState}
          onClose={() => setSelectedZone(null)}
          onSelectSpot={setSelectedSpot}
        />
      )}

      <SpotDetailPanel spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
    </div>
  );
}
