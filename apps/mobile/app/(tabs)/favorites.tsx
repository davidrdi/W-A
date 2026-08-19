import type { Favorite, ScoredSpot } from "@w-a/shared";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "../../src/auth";
import { SpotDetailModal } from "../../src/components/SpotDetailModal";
import { SportPin } from "../../src/components/SportPin";

function favoriteToSpot(favorite: Favorite): ScoredSpot {
  // El score/banda son provisionales: el modal pide la explicación real a
  // /explain en cuanto se abre, que recalcula el score con la meteo actual.
  return { id: favorite.spotId, name: favorite.spotName, lat: favorite.lat, lon: favorite.lon, sport: favorite.sport, score: 0, scoreBand: "yellow" };
}

export default function FavoritesScreen() {
  const { loading, session, favorites, isSupabaseConfigured, signIn, signUp, signOut } = useAuth();
  const [selectedSpot, setSelectedSpot] = useState<ScoredSpot | null>(null);

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notice}>
          Favoritos necesita un proyecto Supabase configurado (ver README). Todavía no hay
          credenciales en este entorno.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return <AuthForm signIn={signIn} signUp={signUp} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.email}>{session.user.email}</Text>
        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Cerrar sesión</Text>
        </Pressable>
      </View>

      {favorites.length === 0 && <Text style={styles.empty}>Aún no tienes favoritos guardados.</Text>}

      {favorites.map((favorite) => (
        <Pressable key={favorite.id} style={styles.card} onPress={() => setSelectedSpot(favoriteToSpot(favorite))}>
          <SportPin sport={favorite.sport} scoreBand="green" />
          <Text style={styles.cardName}>{favorite.spotName}</Text>
        </Pressable>
      ))}

      <SpotDetailModal spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
    </ScrollView>
  );
}

function AuthForm({
  signIn,
  signUp,
}: {
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
}) {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const action = mode === "signIn" ? signIn : signUp;
    const message = await action(email.trim(), password);
    setSubmitting(false);
    if (message) setError(message);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{mode === "signIn" ? "Inicia sesión" : "Crea una cuenta"}</Text>
      <Text style={styles.subtitle}>Guarda tus zonas favoritas para volver a ellas rápido.</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Contraseña" secureTextEntry />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={submit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{mode === "signIn" ? "Entrar" : "Registrarme"}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
        <Text style={styles.switchMode}>
          {mode === "signIn" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  notice: {
    textAlign: "center",
    color: "#52625A",
    fontSize: 14,
  },
  container: {
    padding: 20,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  email: {
    fontSize: 15,
    fontWeight: "600",
  },
  signOut: {
    color: "#B4432E",
    fontWeight: "600",
  },
  empty: {
    color: "#52625A",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F2F4F1",
    borderRadius: 12,
    padding: 12,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: "#52625A",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D3DCCE",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  error: {
    color: "#B4432E",
  },
  button: {
    backgroundColor: "#235C4D",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  switchMode: {
    textAlign: "center",
    color: "#235C4D",
    fontWeight: "600",
  },
});
