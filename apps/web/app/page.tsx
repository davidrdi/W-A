"use client";

import { useState } from "react";

import { BuscarTab } from "../components/BuscarTab";
import { FavoritosTab } from "../components/FavoritosTab";
import { Header } from "../components/Header";
import { MapaTab } from "../components/MapaTab";

type Tab = "mapa" | "buscar" | "favoritos";

export default function Home() {
  const [tab, setTab] = useState<Tab>("buscar");

  return (
    <div className="flex h-screen flex-col">
      <Header tab={tab} onChangeTab={setTab} />
      <main className="flex flex-1 overflow-hidden">
        {tab === "mapa" ? <MapaTab /> : tab === "favoritos" ? <FavoritosTab /> : <BuscarTab />}
      </main>
    </div>
  );
}
