"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { QueryResponse, RankedSpot } from "@w-a/shared";
import { SCORE_BAND_COLOR, distanceKm, formatDistanceKm } from "@w-a/shared";

import { submitQuery } from "../lib/api";
import { ScoreLegend } from "./ScoreLegend";
import { SpotDetailPanel } from "./SpotDetailPanel";
import type { MapSpot } from "./map/MapView";

const MapView = dynamic(() => import("./map/MapView"), { ssr: false });

const EXAMPLES = ["Playa en el sur de Galicia", "Quiero correr en Coruña sin hacer trail", "Senderismo cerca de Sevilla"];

type State = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done" };

export function BuscarTab() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [selectedSpot, setSelectedSpot] = useState<RankedSpot | null>(null);

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

  const selectedDistanceLabel = useMemo(() => {
    if (!selectedSpot || !result) return undefined;
    return formatDistanceKm(distanceKm(result.localityCenter, { lat: selectedSpot.lat, lon: selectedSpot.lon }));
  }, [selectedSpot, result]);

  const mapSpots: MapSpot[] = (result?.spots ?? []).map((s) => ({
    id: s.id,
    lat: s.lat,
    lon: s.lon,
    sport: s.sport,
    scoreBand: s.scoreBand,
    name: s.name,
    description: s.headline,
  }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-bold text-textPrimary">¿Dónde y qué te apetece hacer?</h1>
        <p className="text-sm text-textSecondary">Escribe en lenguaje natural, como se lo pedirías a un amigo.</p>
      </div>

      <textarea
        className="min-h-[90px] rounded-xl border border-border px-4 py-3 text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ej. playa en el sur de Galicia"
        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), search())}
      />

      {state.kind !== "loading" && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              onClick={() => setText(example)}
              className="rounded-full bg-surface px-2.5 py-1.5 text-xs text-textPrimary"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      <button
        className="rounded-lg bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
        onClick={search}
        disabled={state.kind === "loading"}
      >
        {state.kind === "loading" ? "Buscando…" : "Buscar"}
      </button>

      {state.kind === "error" && <p className="text-sm text-danger">{state.message}</p>}

      {state.kind === "done" && result && (
        <>
          <h2 className="text-sm font-bold capitalize text-textPrimary">
            {result.spots.length > 0
              ? `${result.intent.sport} en ${result.locality}`
              : `Sin resultados en ${result.locality} con esos filtros`}
          </h2>

          {result.spots.length > 0 && (
            <>
              <div className="h-52 overflow-hidden rounded-xl">
                <MapView
                  spots={mapSpots}
                  center={result.localityCenter}
                  zoom={12}
                  fitToSpots
                  onSelectSpot={(id) => setSelectedSpot(result.spots.find((s) => s.id === id) ?? null)}
                />
              </div>
              <ScoreLegend />
            </>
          )}

          {result.spots.map((spot, index) => {
            const distanceLabel = formatDistanceKm(distanceKm(result.localityCenter, { lat: spot.lat, lon: spot.lon }));
            return (
              <button
                key={spot.id}
                onClick={() => setSelectedSpot(spot)}
                className="flex flex-col gap-1.5 rounded-xl bg-surface p-3.5 text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: SCORE_BAND_COLOR[spot.scoreBand] }}
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-textPrimary">{spot.name}</p>
                    <p className="text-xs text-textSecondary">A {distanceLabel}</p>
                  </div>
                  <span className="text-base font-bold text-textPrimary">{spot.score}</span>
                </div>
                <p className="text-sm font-semibold text-textPrimary">{spot.headline}</p>
                {spot.reasoning && <p className="text-sm text-textPrimary/80">{spot.reasoning}</p>}
              </button>
            );
          })}
        </>
      )}

      <SpotDetailPanel
        spot={selectedSpot}
        distanceLabel={selectedDistanceLabel}
        nearbySpots={result?.spots ?? []}
        onClose={() => setSelectedSpot(null)}
      />
    </div>
  );
}
