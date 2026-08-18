"use client";

import { useEffect, useState } from "react";
import type { ChatMessage, ScoredSpot, SpotExplanation } from "@w-a/shared";
import { SCORE_BAND_COLOR } from "@w-a/shared";

import { askFollowUp, explainSpot } from "../lib/api";
import { useAuth } from "./auth/AuthProvider";

interface Props {
  spot: ScoredSpot | null;
  distanceLabel?: string;
  onClose: () => void;
}

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };

export function SpotDetailPanel({ spot, distanceLabel, onClose }: Props) {
  const [explanation, setExplanation] = useState<SpotExplanation | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const { session, isFavorite, toggleFavorite } = useAuth();

  useEffect(() => {
    if (!spot) return;
    setExplanation(null);
    setMessages([]);
    setQuestion("");
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

  if (!spot) return null;

  const favorited = isFavorite(spot.id, spot.sport);

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

  const send = async () => {
    const trimmed = question.trim();
    if (!trimmed || !explanation || asking) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setQuestion("");
    setAsking(true);
    try {
      const { answer } = await askFollowUp(explanation.groundingPayload, messages, trimmed);
      setMessages([...nextMessages, { role: "assistant", content: answer }]);
    } catch (error) {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: error instanceof Error ? error.message : "No se pudo responder." },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const amenities = explanation?.groundingPayload.amenities;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-6 shadow-xl"
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

        {loadState.kind === "loading" && <p className="text-sm text-textSecondary">Cargando explicación…</p>}
        {loadState.kind === "error" && <p className="text-sm text-danger">{loadState.message}</p>}

        {loadState.kind === "ready" && explanation && (
          <>
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: SCORE_BAND_COLOR[explanation.scoreBand] }}
              >
                {explanation.score}
              </span>
              <p className="text-sm font-semibold text-textPrimary">{explanation.headline}</p>
            </div>

            {(amenities?.naturist || amenities?.dogsAllowed) && (
              <div className="flex flex-wrap gap-2">
                {amenities?.naturist && (
                  <span className="rounded-full bg-surface px-3 py-1 text-xs text-textSecondary">Playa nudista</span>
                )}
                {amenities?.dogsAllowed && (
                  <span className="rounded-full bg-surface px-3 py-1 text-xs text-textSecondary">
                    Admite mascotas
                  </span>
                )}
              </div>
            )}

            <p className="text-sm text-textPrimary">{explanation.reasoning}</p>
            {explanation.cautions.map((caution) => (
              <p key={caution} className="text-sm text-danger">
                ⚠ {caution}
              </p>
            ))}

            <div className="flex flex-1 flex-col gap-2 border-t border-border pt-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    m.role === "user" ? "self-end bg-primary text-white" : "self-start bg-surface text-textPrimary"
                  }`}
                >
                  {m.content}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Pregunta algo más sobre esta zona…"
                disabled={asking}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={send}
                disabled={asking}
              >
                {asking ? "…" : "▶"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
