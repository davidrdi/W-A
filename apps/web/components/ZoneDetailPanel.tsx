"use client";

import type { ScoredSpot, ZoneChip, ZoneDetailResponse, ZoneMode } from "@w-a/shared";
import { SCORE_BAND_COLOR, SPORT_LABEL } from "@w-a/shared";

export type ZoneDetailState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; detail: ZoneDetailResponse };

interface Props {
  zone: ZoneChip;
  mode: ZoneMode;
  state: ZoneDetailState;
  onClose: () => void;
  onSelectSpot: (spot: ScoredSpot) => void;
}

const LEVEL_LABEL: Record<ZoneChip["level"], string> = {
  provincia: "Provincia",
  municipio: "Municipio",
  local: "Zona",
};

export function ZoneDetailPanel({ zone, mode, state, onClose, onSelectSpot }: Props) {
  return (
    <div className="fixed inset-0 z-[1100] flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-textSecondary">{LEVEL_LABEL[zone.level]}</p>
            <h2 className="text-lg font-bold text-textPrimary">{zone.name}</h2>
          </div>
          <button onClick={onClose} className="text-sm font-semibold text-textSecondary hover:text-textPrimary">
            Cerrar
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-white"
            style={{ backgroundColor: SCORE_BAND_COLOR[zone.scoreBand] }}
          >
            {zone.score}
          </span>
          <p className="text-sm text-textSecondary">
            Condiciones de hoy para hacer deporte {mode === "mar" ? "en la costa" : "en tierra"}
          </p>
        </div>

        {state.kind === "loading" && <p className="text-sm text-textSecondary">Cargando la zona…</p>}
        {state.kind === "error" && <p className="text-sm text-danger">{state.message}</p>}

        {state.kind === "ready" && (
          <>
            <ConditionsGrid detail={state.detail} mode={mode} />

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-textPrimary">Qué encaja mejor hoy</h3>
              {state.detail.sportFits.map((fit) => (
                <div key={fit.sport} className="flex items-center gap-2">
                  <span className="w-24 text-sm text-textPrimary">{SPORT_LABEL[fit.sport]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${fit.score}%`, backgroundColor: SCORE_BAND_COLOR[fit.scoreBand] }}
                    />
                  </span>
                  <span className="w-8 text-right text-sm font-semibold text-textSecondary">{fit.score}</span>
                </div>
              ))}
            </section>

            <SpotList
              title={mode === "mar" ? "Mejores playas de la zona" : "Mejores sitios de la zona"}
              spots={state.detail.best}
              emptyLabel="No hay sitios mapeados en esta zona todavía."
              onSelectSpot={onSelectSpot}
            />

            {state.detail.worst.length > 0 && (
              <SpotList
                title="Los peores hoy"
                spots={state.detail.worst}
                emptyLabel=""
                onSelectSpot={onSelectSpot}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ConditionsGrid({ detail, mode }: { detail: ZoneDetailResponse; mode: ZoneMode }) {
  const { weather, marine } = detail;
  const items: { label: string; value: string }[] = [
    { label: "Temperatura", value: `${weather.temperatureAvgTodayC} °C` },
    { label: "Viento", value: `${weather.windAvgTodayKmh} km/h (máx ${weather.windMaxTodayKmh})` },
    { label: "Lluvia hoy", value: `${weather.rainTodayMm} mm` },
    { label: "Lluvia ayer", value: `${weather.rainYesterdayMm} mm` },
  ];
  if (mode === "mar" && marine) {
    items.push(
      { label: "Oleaje", value: `${marine.waveHeightAvgM} m (máx ${marine.waveHeightMaxM})` },
      { label: "Agua", value: `${marine.seaSurfaceTempC} °C` },
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-surface px-3 py-2">
          <dt className="text-xs text-textSecondary">{item.label}</dt>
          <dd className="text-sm font-semibold text-textPrimary">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SpotList({
  title,
  spots,
  emptyLabel,
  onSelectSpot,
}: {
  title: string;
  spots: ScoredSpot[];
  emptyLabel: string;
  onSelectSpot: (spot: ScoredSpot) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-bold text-textPrimary">{title}</h3>
      {spots.length === 0 && emptyLabel && <p className="text-sm text-textSecondary">{emptyLabel}</p>}
      {spots.map((spot) => (
        <button
          key={spot.id}
          onClick={() => onSelectSpot(spot)}
          className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-left hover:bg-surface"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: SCORE_BAND_COLOR[spot.scoreBand] }}
          >
            {spot.score}
          </span>
          <span className="flex-1 text-sm text-textPrimary">{spot.name}</span>
          <span className="text-xs text-textSecondary">{SPORT_LABEL[spot.sport]}</span>
        </button>
      ))}
    </section>
  );
}
