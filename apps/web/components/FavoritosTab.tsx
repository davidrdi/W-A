"use client";

import { useState } from "react";
import type { Favorite, ScoredSpot } from "@w-a/shared";

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

      {favorites.map((favorite) => (
        <button
          key={favorite.id}
          onClick={() => setSelected(favorite)}
          className="flex items-center gap-3 rounded-xl bg-surface p-3.5 text-left"
        >
          <div className="flex-1">
            <p className="text-sm font-bold text-textPrimary">{favorite.spotName}</p>
            <p className="text-xs capitalize text-textSecondary">{favorite.sport}</p>
          </div>
        </button>
      ))}

      <SpotDetailPanel spot={selected ? toScoredSpot(selected) : null} onClose={() => setSelected(null)} />
    </div>
  );
}
