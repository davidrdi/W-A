import cors from "@fastify/cors";
import Fastify from "fastify";
import type { HealthResponse } from "@w-a/shared";

import { registerRecommendRoute } from "./routes/recommend.js";

const PORT = Number(process.env.PORT ?? 3000);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async (): Promise<HealthResponse> => {
  return { status: "ok", service: "w-a-backend" };
});

await registerRecommendRoute(app);

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
