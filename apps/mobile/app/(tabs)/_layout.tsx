import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="map" options={{ title: "Mapa" }} />
      <Tabs.Screen name="weather" options={{ title: "Tiempo" }} />
    </Tabs>
  );
}
