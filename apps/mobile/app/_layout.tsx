import { Stack } from "expo-router";

import { AuthProvider } from "../src/auth";
import { OnboardingGate } from "../src/components/OnboardingGate";

export default function RootLayout() {
  return (
    <OnboardingGate>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </OnboardingGate>
  );
}
