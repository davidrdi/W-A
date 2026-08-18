import cors from "@fastify/cors";
import Fastify from "fastify";
import type { HealthResponse } from "@w-a/shared";

import { registerExplainRoute } from "./routes/explain.js";
import { registerFavoritesRoute } from "./routes/favorites.js";
import { registerInternalNotifyRoute } from "./routes/internalNotify.js";
import { registerPushTokensRoute } from "./routes/pushTokens.js";
import { registerRecommendRoute } from "./routes/recommend.js";
import { registerSpotScoresRoute } from "./routes/spotScores.js";
import { registerSpotsRoute } from "./routes/spots.js";
import { registerWeatherRoute } from "./routes/weather.js";
import { registerZonesRoute } from "./routes/zones.js";

const PORT = Number(process.env.PORT ?? 3000);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async (): Promise<HealthResponse> => {
  return { status: "ok", service: "w-a-backend" };
});

await registerRecommendRoute(app);
await registerSpotsRoute(app);
await registerSpotScoresRoute(app);
await registerExplainRoute(app);
await registerWeatherRoute(app);
await registerZonesRoute(app);
await registerFavoritesRoute(app);
await registerPushTokensRoute(app);
await registerInternalNotifyRoute(app);

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
