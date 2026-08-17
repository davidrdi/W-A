import { isWaterSport } from "../lib/sport.js";
import { scoreBandFor, scoreLandSport, scoreWaterSport } from "../scoring/rules.js";
import { listAllFavorites, markFavoriteNotified } from "./favoritesDb.js";
import { getMarineSnapshots } from "./marine.js";
import { listPushTokensByUserIds } from "./pushTokensDb.js";
import { sendExpoPushNotifications } from "./push.js";
import { getWeatherSnapshots } from "./weather.js";

export interface NotifyResult {
  evaluated: number;
  sent: number;
}

// Pensado para ser llamado una vez al día por un scheduler externo (cron,
// Supabase scheduled function...) vía POST /internal/notify-favorites — no
// hay scheduler propio corriendo dentro de este backend.
export async function notifyFavorites(today: string): Promise<NotifyResult> {
  const favorites = await listAllFavorites();
  const due = favorites.filter((f) => f.lastNotifiedDate !== today);
  if (due.length === 0) return { evaluated: 0, sent: 0 };

  const userIds = [...new Set(due.map((f) => f.userId))];
  const tokensByUser = await listPushTokensByUserIds(userIds);

  let sent = 0;
  for (const favorite of due) {
    const tokens = tokensByUser[favorite.userId];
    if (!tokens || tokens.length === 0) {
      // Sin token no hay a quién avisar, pero se marca igual para no
      // recalcular su score cada vez que corra el job el mismo día.
      await markFavoriteNotified(favorite.id, today);
      continue;
    }

    const [weather] = await getWeatherSnapshots([{ lat: favorite.lat, lon: favorite.lon }]);

    let score: number;
    if (isWaterSport(favorite.sport)) {
      const [marine] = await getMarineSnapshots([{ lat: favorite.lat, lon: favorite.lon }]);
      score = scoreWaterSport(favorite.sport, weather, marine);
    } else {
      score = scoreLandSport(favorite.sport, weather);
    }

    if (scoreBandFor(score) === "green") {
      await sendExpoPushNotifications(
        tokens.map((to) => ({
          to,
          title: `Hoy es buen día para ${favorite.spotName}`,
          body: `${favorite.sport} — puntuación ${score}/100.`,
        })),
      );
      sent++;
    }

    await markFavoriteNotified(favorite.id, today);
  }

  return { evaluated: due.length, sent };
}
