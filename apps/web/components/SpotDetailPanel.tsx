"use client";

import { useEffect, useMemo, useState } from "react";
import type { AlternativesResponse, ScoredSpot, SpotExplanation, TideEvent } from "@w-a/shared";
import { SCORE_BAND_COLOR, sunTimes } from "@w-a/shared";

import { explainSpot, fetchAlternatives } from "../lib/api";
import { useAuth } from "./auth/AuthProvider";

interface Props {
  spot: ScoredSpot | null;
  distanceLabel?: string;
  /** Resto de zonas cargadas en el mapa: son las candidatas de la función de IA. */
  nearbySpots?: ScoredSpot[];
  onClose: () => void;
}

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };
type AiState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: AlternativesResponse };

function formatTime(iso: string): string {
  // Open-Meteo devuelve hora local del punto ("2026-08-19T14:00"), sin zona.
  const time = iso.split("T")[1] ?? "";
  return time.slice(0, 5);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2">
      <p className="text-xs text-textSecondary">{label}</p>
      <p className="text-sm font-semibold text-textPrimary">{value}</p>
    </div>
  );
}

function Tides({ tides }: { tides: TideEvent[] }) {
  // Solo las que quedan por delante: una pleamar de las 03:00 no ayuda a las 18:00.
  const nowHhMm = new Date().toTimeString().slice(0, 5);
  const upcoming = tides.filter((t) => formatTime(t.time) >= nowHhMm).slice(0, 2);
  const shown = upcoming.length > 0 ? upcoming : tides.slice(-2);
  if (shown.length === 0) return null;

  return (
    <div className="rounded-lg bg-surface px-3 py-2">
      <p className="text-xs text-textSecondary">Mareas</p>
      <p className="text-sm font-semibold text-textPrimary">
        {shown.map((t) => `${t.kind === "pleamar" ? "Pleamar" : "Bajamar"} ${formatTime(t.time)}`).join(" · ")}
      </p>
    </div>
  );
}

export function SpotDetailPanel({ spot, distanceLabel, nearbySpots = [], onClose }: Props) {
  const [explanation, setExplanation] = useState<SpotExplanation | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [ai, setAi] = useState<AiState>({ kind: "idle" });
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const { session, isFavorite, toggleFavorite } = useAuth();

  useEffect(() => {
    if (!spot) return;
    setExplanation(null);
    setAi({ kind: "idle" });
    setLoadState({ kind: "loading" });

    explainSpot(spot)
      .then((result) => {
        setExplanation(result);
        setLoadState({ kind: "ready" });
      })
      .catch((error) => {
        setLoadState({ kind: "error", message: error instanceof Error ? error.message : "No se pudo cargar" });
      });
  }, [spot]);

  // Cálculo puro (sin API): posición solar del punto para hoy. Precisión de
  // un par de minutos — ver packages/shared/src/solar.ts para el detalle.
  const sunset = useMemo(() => {
    if (!spot) return null;
    const times = sunTimes(spot.lat, spot.lon, new Date());
    return times ? new Date(times.sunsetUtc) : null;
  }, [spot]);

  if (!spot) return null;

  const favorited = isFavorite(spot.id, spot.sport);
  const weather = explanation?.groundingPayload.weather;
  const marine = explanation?.groundingPayload.marine;
  const amenities = explanation?.groundingPayload.amenities;

  const handleToggleFavorite = async () => {
    if (togglingFavorite) return;
    setTogglingFavorite(true);
    try {
      await toggleFavorite(spot);
    } catch {
      // Un fallo al guardar el favorito no debe romper el panel.
    } finally {
      setTogglingFavorite(false);
    }
  };

  const askAi = async () => {
    setAi({ kind: "loading" });
    try {
      // El backend rechaza más de 20 candidatas (400): en modo vista general
      // nearbySpots puede cubrir todo el país, así que se recorta aquí.
      const data = await fetchAlternatives(
        { sport: spot.sport, spotId: spot.id, name: spot.name, lat: spot.lat, lon: spot.lon },
        nearbySpots.slice(0, 20).map((s) => ({ spotId: s.id, name: s.name, lat: s.lat, lon: s.lon })),
      );
      setAi({ kind: "ready", data });
    } catch (error) {
      setAi({ kind: "error", message: error instanceof Error ? error.message : "No se pudo consultar" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-textPrimary">{spot.name}</h2>
            {distanceLabel && <p className="text-sm text-textSecondary">A {distanceLabel}</p>}
          </div>
          <div className="flex items-center gap-3">
            {session && (
              <button
                onClick={handleToggleFavorite}
                disabled={togglingFavorite}
                aria-label={favorited ? "Quitar de favoritos" : "Añadir a favoritos"}
                className="text-xl leading-none disabled:opacity-50"
              >
                {favorited ? "♥" : "♡"}
              </button>
            )}
            <button onClick={onClose} className="text-sm font-semibold text-textSecondary hover:text-textPrimary">
              Cerrar
            </button>
          </div>
        </div>

        {loadState.kind === "loading" && <p className="text-sm text-textSecondary">Cargando condiciones…</p>}
        {loadState.kind === "error" && <p className="text-sm text-danger">{loadState.message}</p>}

        {loadState.kind === "ready" && explanation && weather && (
          <>
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: SCORE_BAND_COLOR[explanation.scoreBand] }}
              >
                {explanation.score}
              </span>
              <p className="text-sm font-semibold text-textPrimary">{explanation.headline}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Metric label="Viento" value={`${Math.round(weather.windAvgTodayKmh)} km/h`} />
              <Metric label="Rachas" value={`${Math.round(weather.windMaxTodayKmh)} km/h`} />
              <Metric label="Temperatura" value={`${Math.round(weather.temperatureAvgTodayC)} °C`} />
              <Metric label="Lluvia hoy" value={`${Math.round(weather.rainTodayMm)} mm`} />
              {marine && <Metric label="Oleaje" value={`${marine.waveHeightAvgM} m (máx ${marine.waveHeightMaxM})`} />}
              {marine && <Metric label="Agua" value={`${marine.seaSurfaceTempC} °C`} />}
              {marine?.tides && marine.tides.length > 0 && <Tides tides={marine.tides} />}
              {sunset && (
                <Metric
                  label="Puesta de sol"
                  value={sunset.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                />
              )}
            </div>

            {/* Diagnóstico: por qué puntúa así. Sale del scoring, no de la IA. */}
            <div className="flex flex-col gap-1.5">
              {explanation.factors.map((factor) => (
                <div key={factor.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-textPrimary">
                    {factor.label} <span className="text-textSecondary">· {factor.detail}</span>
                  </span>
                  <span className={factor.impact < 0 ? "font-semibold text-danger" : "font-semibold text-scoreGreen"}>
                    {factor.impact > 0 ? `+${factor.impact}` : factor.impact} pts
                  </span>
                </div>
              ))}
            </div>

            {(amenities?.naturist || amenities?.dogsAllowed || amenities?.lifeguard) && (
              <div className="flex flex-wrap gap-2">
                {amenities?.naturist && (
                  <span className="rounded-full bg-surface px-3 py-1 text-xs text-textSecondary">Playa nudista</span>
                )}
                {amenities?.dogsAllowed && (
                  <span className="rounded-full bg-surface px-3 py-1 text-xs text-textSecondary">
                    Admite mascotas
                  </span>
                )}
                {amenities?.lifeguard === "yes" && (
                  <span className="rounded-full bg-surface px-3 py-1 text-xs text-textSecondary">
                    Con socorrista
                  </span>
                )}
                {amenities?.lifeguard === "seasonal" && (
                  <span className="rounded-full bg-surface px-3 py-1 text-xs text-textSecondary">
                    Socorrista en temporada alta
                  </span>
                )}
              </div>
            )}

            <div className="mt-auto border-t border-border pt-4">
              {ai.kind === "idle" && (
                <button
                  onClick={askAi}
                  disabled={nearbySpots.length <= 1}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  ✨ ¿Hay algo mejor cerca?
                </button>
              )}
              {ai.kind === "loading" && <p className="text-sm text-textSecondary">Comparando con las zonas cercanas…</p>}
              {ai.kind === "error" && <p className="text-sm text-danger">{ai.message}</p>}
              {ai.kind === "ready" && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-textPrimary">{ai.data.verdict}</p>
                  {ai.data.alternatives.map((alt) => (
                    <div key={alt.spotId} className="rounded-xl bg-surface p-3">
                      <p className="text-sm font-bold text-textPrimary">
                        {alt.name} <span className="font-normal text-textSecondary">· a {alt.distanceKm} km</span>
                      </p>
                      <p className="text-sm text-textPrimary">{alt.why}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
