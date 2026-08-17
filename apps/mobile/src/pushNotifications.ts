import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

/**
 * Pide permiso y devuelve el Expo push token, o null si no se puede
 * (permiso denegado, sin dispositivo físico, o sin proyecto EAS
 * configurado en app.json). Nunca lanza — no debe romper el login por
 * esto, solo significa que no habrá notificaciones proactivas.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch {
    return null;
  }
}
