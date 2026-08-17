import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "W-A — Dónde hacer deporte hoy",
  description:
    "Previsión meteorológica, estado del terreno y recomendación de zona por deporte (running, senderismo, bici, playa, surf, windsurf) en toda España.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
