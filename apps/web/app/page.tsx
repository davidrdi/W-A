"use client";

import { useState } from "react";

import { FavoritosTab } from "../components/FavoritosTab";
import { Header } from "../components/Header";
import { MapaTab } from "../components/MapaTab";
import { ZonasTab } from "../components/ZonasTab";

type Tab = "zonas" | "mapa" | "favoritos";

export default function Home() {
  const [tab, setTab] = useState<Tab>("zonas");

  return (
    <div className="flex h-screen flex-col">
      <Header tab={tab} onChangeTab={setTab} />
      <main className="flex flex-1 overflow-hidden">
        {tab === "mapa" ? <MapaTab /> : tab === "favoritos" ? <FavoritosTab /> : <ZonasTab />}
      </main>
    </div>
  );
}
