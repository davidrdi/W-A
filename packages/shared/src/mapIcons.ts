import type { ScoreBand, Sport } from "./types.js";

// Iconos portados del sistema de pines de Trebo (github.com/davidrdi/trebo,
// nextjs/lib/sport-icons.ts): viewBox 20x20, trazo/relleno blanco, pensados
// para ir dentro de un pin de color. "playa" es nuevo, en el mismo estilo
// (silueta mínima + ola de la base que ya usan surf/windsurf/vela). Vive en
// shared porque tanto mobile (SvgXml) como web (divIcon HTML de Leaflet)
// pintan el mismo pin a partir de este mismo string.
export const SPORT_ICON_SVG: Record<Sport, string> = {
  running: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="13" cy="4" r="2" fill="white"/>
    <path d="M8 8l3-2 2 3-2 4-3 1M11 9l3 2 2 4M6 11l-2 5M13 6l2 1" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  paseo: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="4" r="1.8" fill="white"/>
    <path d="M10 6.5v4M7.5 8.5l2.5 2 2.5-2M8 14.5l-1.5 3.5M12 14.5l1.5 3.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6 11c1 .5 2.5.8 4 .8s3-.3 4-.8" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="5" cy="15" r="1.2" fill="white" opacity="0.6"/>
    <circle cx="15" cy="15" r="1.2" fill="white" opacity="0.6"/>
  </svg>`,

  senderismo: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="4" r="2" fill="white"/>
    <path d="M10 6v4l-3 6M10 10l3 6" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M7 8l3 2 3-2" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M14 3v-1M14 5l1 1" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  bici: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="5.5" cy="13" r="3" stroke="white" stroke-width="1.4"/>
    <circle cx="14.5" cy="13" r="3" stroke="white" stroke-width="1.4"/>
    <path d="M5.5 13l4-7h3l2 7M9.5 6l-1 7" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="11" cy="4.5" r="1.5" fill="white"/>
  </svg>`,

  playa: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2c3.2 0 6 2.6 6.5 5.5H3.5C4 4.6 6.8 2 10 2z" stroke="white" stroke-width="1.3" fill="white" fill-opacity="0.2" stroke-linejoin="round"/>
    <path d="M10 2v13" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M10 12l-3.5 3.5" stroke="white" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M2 17c2-1 4-1 6 0s4 1 6 0" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,

  surf: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2c1 5-1 10-4 14l-3 2c-1-4 1-10 4-14l3-2z" stroke="white" stroke-width="1.4" fill="white" fill-opacity="0.2" stroke-linecap="round"/>
    <path d="M9 11l2-4" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M2 16c2-1 4-1 6 0s4 1 6 0" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,

  windsurf: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 3v10" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M10 3l5 6-5 4" stroke="white" stroke-width="1.3" fill="white" fill-opacity="0.2" stroke-linejoin="round"/>
    <path d="M6 16h8c1 0 1-1 0-1.5L10 13l-4 1.5c-1 .5-1 1.5 0 1.5z" stroke="white" stroke-width="1.2" fill="white" fill-opacity="0.15"/>
    <path d="M2 18c2-1 4-1 6 0s4 1 6 0" stroke="white" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
  </svg>`,
};

export const SPORT_LABEL: Record<Sport, string> = {
  running: "Running",
  paseo: "Paseo",
  senderismo: "Senderismo",
  bici: "Bici",
  playa: "Playa",
  surf: "Surf",
  windsurf: "Windsurf",
};

export const SCORE_BAND_COLOR: Record<ScoreBand, string> = {
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#dc2626",
};

// HTML de un pin en forma de lágrima (border-radius 50% 50% 50% 0 +
// rotate -45deg), igual que los marcadores de Trebo — el color codifica el
// score de la zona, el icono el deporte. Pensado para L.divIcon en web
// (apps/web) y equivalente a <SportPin> en mobile (mismo SPORT_ICON_SVG /
// SCORE_BAND_COLOR, una sola fuente de verdad).
export function buildPinHtml(sport: Sport, scoreBand: ScoreBand): string {
  const color = SCORE_BAND_COLOR[scoreBand];
  const icon = SPORT_ICON_SVG[sport];
  return `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
    <div style="width:26px;height:26px;border-radius:13px 13px 13px 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;">
      <div style="transform:rotate(45deg);width:14px;height:14px;line-height:0;">${icon}</div>
    </div>
  </div>`;
}
