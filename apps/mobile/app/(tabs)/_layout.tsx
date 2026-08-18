import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: "Mapa" }} />
      <Tabs.Screen name="weather" options={{ title: "Tiempo" }} />
      <Tabs.Screen name="favorites" options={{ title: "Favoritos" }} />
    </Tabs>
  );
}
