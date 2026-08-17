"use client";

type Tab = "mapa" | "buscar";

interface Props {
  tab: Tab;
  onChangeTab: (tab: Tab) => void;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "buscar", label: "Buscar" },
  { key: "mapa", label: "Mapa" },
];

export function Header({ tab, onChangeTab }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-border px-5 py-3">
      <span className="text-lg font-bold text-primary">W-A</span>
      <nav className="flex gap-1 rounded-lg bg-surface p-1">
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
    </header>
  );
}
