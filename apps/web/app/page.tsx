"use client";

import { useState } from "react";

import { BuscarTab } from "../components/BuscarTab";
import { Header } from "../components/Header";
import { MapaTab } from "../components/MapaTab";

type Tab = "mapa" | "buscar";

export default function Home() {
  const [tab, setTab] = useState<Tab>("buscar");

  return (
    <div className="flex h-screen flex-col">
      <Header tab={tab} onChangeTab={setTab} />
      <main className="flex flex-1 overflow-hidden">{tab === "mapa" ? <MapaTab /> : <BuscarTab />}</main>
    </div>
  );
}
