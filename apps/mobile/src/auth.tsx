import type { Session } from "@supabase/supabase-js";
import type { Favorite, Sport } from "@w-a/shared";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { addFavorite, fetchFavorites, registerPushToken, removeFavorite } from "./api";
import { getExpoPushToken } from "./pushNotifications";
import { isSupabaseConfigured, supabase } from "./supabase";

interface FavoritableSpot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  sport: Sport;
}

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  favorites: Favorite[];
  isSupabaseConfigured: boolean;
  signIn(email: string, password: string): Promise<string | null>;
  signUp(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  isFavorite(spotId: string, sport: Sport): boolean;
  toggleFavorite(spot: FavoritableSpot): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const refreshFavorites = useCallback(async () => {
    if (!session) {
      setFavorites([]);
      return;
    }
    try {
      const { favorites: list } = await fetchFavorites(session.access_token);
      setFavorites(list);
    } catch {
      // Un fallo al refrescar favoritos no debe tumbar el resto de la app.
    }
  }, [session]);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  // Al iniciar sesión, se registra el push token si el usuario da permiso
  // (V2: notificaciones de favoritos). Falla en silencio sin proyecto EAS
  // configurado o sin dispositivo físico — no debe romper el login.
  useEffect(() => {
    if (!session) return;
    getExpoPushToken().then((token) => {
      if (token) registerPushToken(session.access_token, token).catch(() => {});
    });
  }, [session]);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return "Supabase no está configurado todavía.";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const signUp = async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return "Supabase no está configurado todavía.";
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const isFavorite = (spotId: string, sport: Sport) =>
    favorites.some((f) => f.spotId === spotId && f.sport === sport);

  const toggleFavorite = async (spot: FavoritableSpot) => {
    if (!session) return;
    const existing = favorites.find((f) => f.spotId === spot.id && f.sport === spot.sport);
    if (existing) {
      await removeFavorite(session.access_token, existing.id);
    } else {
      await addFavorite(session.access_token, {
        spotId: spot.id,
        spotName: spot.name,
        sport: spot.sport,
        lat: spot.lat,
        lon: spot.lon,
      });
    }
    await refreshFavorites();
  };

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        favorites,
        isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        isFavorite,
        toggleFavorite,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
