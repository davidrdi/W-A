"use client";

import { useEffect, useState } from "react";
import type { Favorite, ScoredSpot } from "@w-a/shared";
import { SCORE_BAND_COLOR, SPORT_LABEL } from "@w-a/shared";

import { fetchSpotScore } from "../lib/api";
import { useAuth } from "./auth/AuthProvider";
import { SpotDetailPanel } from "./SpotDetailPanel";

function toScoredSpot(favorite: Favorite): ScoredSpot {
  return {
    id: favorite.spotId,
    name: favorite.spotName,
    lat: favorite.lat,
    lon: favorite.lon,
    sport: favorite.sport,
    // No usados para pedir la explicación (solo para tipar) — SpotDetailPanel
    // muestra el score que devuelve /explain, no este valor de relleno.
    score: 0,
    scoreBand: "green",
  };
}

type ScoreState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; score: number; scoreBand: "green" | "amber" | "red" };

/** Tarjeta de un favorito: pide su score actual (ligero, sin el desglose de /explain). */
function FavoriteCard({ favorite, onOpen }: { favorite: Favorite; onOpen: () => void }) {
  const [state, setState] = useState<ScoreState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    fetchSpotScore(favorite.sport, favorite.lat, favorite.lon)
      .then((result) => {
        if (cancelled) return;
        const own = result.scores.find((s) => s.sport === favorite.sport);
        if (own) setState({ kind: "ready", score: own.score, scoreBand: own.scoreBand });
        else setState({ kind: "error" });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [favorite.sport, favorite.lat, favorite.lon]);

  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-3 rounded-xl border border-white/60 bg-white/80 p-3.5 text-left shadow-sm backdrop-blur-md"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ backgroundColor: state.kind === "ready" ? SCORE_BAND_COLOR[state.scoreBand] : "#9ca3af" }}
      >
        {state.kind === "ready" ? state.score : state.kind === "loading" ? "…" : "?"}
      </span>
      <div className="flex-1">
        <p className="text-sm font-bold text-textPrimary">{favorite.spotName}</p>
        <p className="text-xs text-textSecondary">{SPORT_LABEL[favorite.sport]}</p>
      </div>
    </button>
  );
}

export function FavoritosTab() {
  const { loading, session, isSupabaseConfigured, favorites } = useAuth();
  const [selected, setSelected] = useState<Favorite | null>(null);

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-start justify-center p-6">
        <p className="text-sm text-textSecondary">Favoritos no está disponible todavía en este entorno.</p>
      </div>
    );
  }

  if (loading) return null;

  if (!session) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-semibold text-textPrimary">Inicia sesión para guardar tus zonas favoritas</p>
        <p className="text-sm text-textSecondary">Usa el botón &quot;Entrar con Google&quot; de arriba.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 overflow-y-auto p-6">
      <h1 className="text-2xl font-bold text-textPrimary">Tus favoritos</h1>

      {favorites.length === 0 && (
        <p className="text-sm text-textSecondary">
          Aún no has guardado ninguna zona — pulsa el corazón en el detalle de un spot para añadirlo aquí.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {favorites.map((favorite) => (
          <FavoriteCard key={favorite.id} favorite={favorite} onOpen={() => setSelected(favorite)} />
        ))}
      </div>

      <SpotDetailPanel spot={selected ? toScoredSpot(selected) : null} onClose={() => setSelected(null)} />
    </div>
  );
}
