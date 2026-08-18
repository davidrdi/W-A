"use client";

import { useAuth } from "./auth/AuthProvider";

type Tab = "zonas" | "mapa" | "favoritos";

interface Props {
  tab: Tab;
  onChangeTab: (tab: Tab) => void;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "zonas", label: "Zonas" },
  { key: "mapa", label: "Mapa" },
  { key: "favoritos", label: "Favoritos" },
];

export function Header({ tab, onChangeTab }: Props) {
  const { session, isSupabaseConfigured, signInWithGoogle, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/60 bg-white/90 px-5 py-3 shadow-sm backdrop-blur-md">
      <span className="text-lg font-bold text-primary">W-A</span>
      <nav className="flex gap-1 rounded-lg bg-surface/80 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onChangeTab(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-primary text-white" : "text-textSecondary hover:text-textPrimary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {isSupabaseConfigured &&
        (session ? (
          <button
            onClick={() => signOut()}
            className="whitespace-nowrap text-sm font-semibold text-textSecondary hover:text-textPrimary"
          >
            Cerrar sesión
          </button>
        ) : (
          <button
            onClick={() => signInWithGoogle()}
            className="whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-textPrimary hover:bg-surface"
          >
            Entrar con Google
          </button>
        ))}
    </header>
  );
}
