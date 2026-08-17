import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, type ReactNode } from "react";

import { Onboarding } from "./Onboarding";

const ONBOARDING_KEY = "w-a:onboarding-seen";

export function OnboardingGate({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      setSeen(value === "true");
      setChecked(true);
    });
  }, []);

  // Antes de comprobar AsyncStorage no se renderiza nada — es una lectura
  // local, casi instantánea, mejor que parpadear el onboarding un instante.
  if (!checked) return null;

  if (!seen) {
    return (
      <Onboarding
        onDone={() => {
          setSeen(true);
          AsyncStorage.setItem(ONBOARDING_KEY, "true");
        }}
      />
    );
  }

  return children;
}
