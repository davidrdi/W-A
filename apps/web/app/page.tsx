"use client";

import { useState } from "react";

import { FavoritosTab } from "../components/FavoritosTab";
import { Header } from "../components/Header";
import { MapaTab } from "../components/MapaTab";

type Tab = "mapa" | "favoritos";

export default function Home() {
  const [tab, setTab] = useState<Tab>("mapa");

  return (
    <div className="flex h-screen flex-col">
      <Header tab={tab} onChangeTab={setTab} />
      <main className="flex flex-1 overflow-hidden">{tab === "mapa" ? <MapaTab /> : <FavoritosTab />}</main>
    </div>
  );
}
