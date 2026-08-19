import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/spotsRefresh.js", () => ({ refreshAllSpots: vi.fn() }));

import { refreshAllSpots } from "../services/spotsRefresh.js";
import { registerInternalRefreshSpotsRoute } from "./internalRefreshSpots.js";

const ORIGINAL_SECRET = process.env.INTERNAL_JOB_SECRET;

describe("POST /internal/refresh-spots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_JOB_SECRET = "super-secreto";
  });

  afterEach(() => {
    process.env.INTERNAL_JOB_SECRET = ORIGINAL_SECRET;
  });

  it("rechaza sin la cabecera del secreto", async () => {
    const app = Fastify();
    await registerInternalRefreshSpotsRoute(app);

    const response = await app.inject({ method: "POST", url: "/internal/refresh-spots" });

    expect(response.statusCode).toBe(401);
    expect(refreshAllSpots).not.toHaveBeenCalled();
  });

  it("rechaza con un secreto incorrecto", async () => {
    const app = Fastify();
    await registerInternalRefreshSpotsRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/internal/refresh-spots",
      headers: { "x-internal-secret": "secreto-malo" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("ejecuta el refresco con el secreto correcto", async () => {
    vi.mocked(refreshAllSpots).mockResolvedValue([
      { category: "beach", count: 3120, source: "osm" },
      { category: "urbanPath", count: 45, source: "seed" },
    ]);

    const app = Fastify();
    await registerInternalRefreshSpotsRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/internal/refresh-spots",
      headers: { "x-internal-secret": "super-secreto" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      results: [
        { category: "beach", count: 3120, source: "osm" },
        { category: "urbanPath", count: 45, source: "seed" },
      ],
    });
  });
});
