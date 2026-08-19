"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { buildPinHtml, cardinalDirection, type LatLon, type ScoreBand, type Sport } from "@w-a/shared";

export interface MapSpot {
  id: string;
  lat: number;
  lon: number;
  sport: Sport;
  scoreBand: ScoreBand;
  name: string;
  description?: string;
  windDirectionDeg?: number;
  windAvgKmh?: number;
}

interface Props {
  spots: MapSpot[];
  center: LatLon;
  zoom?: number;
  fitToSpots?: boolean;
  onSelectSpot: (id: string) => void;
}

export default function MapView({ spots, center, zoom = 12, fitToSpots = false, onSelectSpot }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onSelectSpotRef = useRef(onSelectSpot);
  onSelectSpotRef.current = onSelectSpot;
  // El resto de efectos dependen de esto (no solo de `mapRef.current`) para
  // volver a ejecutarse en cuanto el mapa exista. Sin este flag, unos spots
  // que llegan (p.ej. de una respuesta ya cacheada, casi instantánea) antes
  // de que termine el `import("leaflet")` asíncrono de abajo se pierden: el
  // efecto de pintar marcadores mira `mapRef.current`, lo ve `null`, y no
  // vuelve a dispararse solo porque el mapa se cree después.
  const [mapReady, setMapReady] = useState(false);

  // El mapa se crea una sola vez; el resto de efectos lo actualizan.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    import("leaflet").then((L) => {
      if (mapRef.current || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [center.lat, center.lon],
        zoom,
        minZoom: 4,
        maxZoom: 18,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recentra el mapa cuando cambia la localidad buscada (no cuando solo cambian los spots).
  useEffect(() => {
    mapRef.current?.setView([center.lat, center.lon], zoom, { animate: true });
  }, [center.lat, center.lon, zoom, mapReady]);

  // Pinta los marcadores (limpia y repinta; el número de spots por búsqueda es pequeño).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import("leaflet").then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const coords: [number, number][] = [];

      spots.forEach((spot) => {
        const icon = L.divIcon({
          className: "",
          html: buildPinHtml(spot.sport, spot.scoreBand, spot.windDirectionDeg),
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -34],
        });

        const marker = L.marker([spot.lat, spot.lon], { icon, title: spot.name })
          .addTo(map)
          .on("click", () => onSelectSpotRef.current(spot.id));

        const windLine =
          spot.windDirectionDeg === undefined
            ? ""
            : `<div>Viento ${spot.windAvgKmh !== undefined ? `${Math.round(spot.windAvgKmh)} km/h ` : ""}del ${cardinalDirection(spot.windDirectionDeg)}</div>`;

        if (spot.name || spot.description || windLine) {
          marker.bindPopup(
            `<strong>${escapeHtml(spot.name)}</strong>${spot.description ? `<div>${escapeHtml(spot.description)}</div>` : ""}${windLine}`,
            { className: "w-a-popup" },
          );
        }

        markersRef.current.push(marker);
        coords.push([spot.lat, spot.lon]);
      });

      if (fitToSpots && coords.length > 0) {
        map.fitBounds(coords, { padding: [60, 60], animate: true, maxZoom: 15 });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, fitToSpots, mapReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
