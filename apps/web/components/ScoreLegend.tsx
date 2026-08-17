const ITEMS: { color: string; label: string }[] = [
  { color: "var(--color-score-green)", label: "Buenas condiciones" },
  { color: "var(--color-score-amber)", label: "Regular" },
  { color: "var(--color-score-red)", label: "Evita hoy" },
];

export function ScoreLegend() {
  return (
    <div className="flex flex-wrap gap-3">
      {ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-xs text-textSecondary">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
