"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { buildZoneChipHtml, type LatLon, type ZoneChip } from "@w-a/shared";

import type { ZonesViewport } from "../../lib/api";

interface Props {
  zones: ZoneChip[];
  center: LatLon;
  zoom: number;
  /** Se dispara al terminar cada pan/zoom (y una vez al montar). */
  onViewportChange: (viewport: ZonesViewport) => void;
  onSelectZone: (zone: ZoneChip) => void;
}

export default function ZoneMapView({ zones, center, zoom, onViewportChange, onSelectZone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  // Los callbacks se leen por ref: el mapa se crea una sola vez y no debe
  // recrearse porque el padre haya vuelto a renderizar.
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const onSelectZoneRef = useRef(onSelectZone);
  onSelectZoneRef.current = onSelectZone;

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    import("leaflet").then((L) => {
      if (mapRef.current || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [center.lat, center.lon],
        zoom,
        minZoom: 5,
        maxZoom: 16,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      const emitViewport = () => {
        const bounds = map.getBounds();
        onViewportChangeRef.current({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
          zoom: map.getZoom(),
        });
      };

      map.on("moveend", emitViewport);
      mapRef.current = map;
      setTimeout(() => {
        map.invalidateSize();
        emitViewport();
      }, 100);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repinta los chips: son pocos (el backend los limita) y cambian enteros
  // en cada movimiento, así que limpiar y volver a pintar es más simple que
  // diffear marcador a marcador.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import("leaflet").then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      zones.forEach((zone) => {
        const icon = L.divIcon({
          className: "",
          html: buildZoneChipHtml(zone.name, zone.score, zone.scoreBand),
          // El chip se centra solo con un translate en su propio HTML, así
          // que el icono de Leaflet no ocupa caja y no descoloca el anclaje.
          iconSize: [0, 0],
        });

        const marker = L.marker([zone.lat, zone.lon], { icon, title: zone.name, riseOnHover: true })
          .addTo(map)
          .on("click", () => onSelectZoneRef.current(zone));

        markersRef.current.push(marker);
      });
    });
  }, [zones]);

  return <div ref={containerRef} className="h-full w-full" />;
}
