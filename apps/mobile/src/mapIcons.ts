// Iconos portados del sistema de pines de Trebo (github.com/davidrdi/trebo,
// nextjs/lib/sport-icons.ts): viewBox 20x20, trazo/relleno blanco, pensados
// para ir dentro de un pin de color. "playa" es nuevo, en el mismo estilo
// (silueta mínima + ola de la base que ya usan surf/windsurf/vela).
export const SPORT_ICON_SVG: Record<string, string> = {
  running: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="13" cy="4" r="2" fill="white"/>
    <path d="M8 8l3-2 2 3-2 4-3 1M11 9l3 2 2 4M6 11l-2 5M13 6l2 1" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  playa: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2c3.2 0 6 2.6 6.5 5.5H3.5C4 4.6 6.8 2 10 2z" stroke="white" stroke-width="1.3" fill="white" fill-opacity="0.2" stroke-linejoin="round"/>
    <path d="M10 2v13" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M10 12l-3.5 3.5" stroke="white" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M2 17c2-1 4-1 6 0s4 1 6 0" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,
};

export const SCORE_BAND_COLOR: Record<"green" | "amber" | "red", string> = {
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#dc2626",
};
