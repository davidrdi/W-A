import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/favoritesNotifier.js", () => ({ notifyFavorites: vi.fn() }));

import { notifyFavorites } from "../services/favoritesNotifier.js";
import { registerInternalNotifyRoute } from "./internalNotify.js";

const ORIGINAL_SECRET = process.env.INTERNAL_JOB_SECRET;

describe("POST /internal/notify-favorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_JOB_SECRET = "super-secreto";
  });

  afterEach(() => {
    process.env.INTERNAL_JOB_SECRET = ORIGINAL_SECRET;
  });

  it("rechaza sin la cabecera del secreto", async () => {
    const app = Fastify();
    await registerInternalNotifyRoute(app);

    const response = await app.inject({ method: "POST", url: "/internal/notify-favorites" });

    expect(response.statusCode).toBe(401);
    expect(notifyFavorites).not.toHaveBeenCalled();
  });

  it("rechaza con un secreto incorrecto", async () => {
    const app = Fastify();
    await registerInternalNotifyRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/internal/notify-favorites",
      headers: { "x-internal-secret": "secreto-malo" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("rechaza si no hay INTERNAL_JOB_SECRET configurado en el entorno", async () => {
    process.env.INTERNAL_JOB_SECRET = "";
    const app = Fastify();
    await registerInternalNotifyRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/internal/notify-favorites",
      headers: { "x-internal-secret": "cualquier-cosa" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("ejecuta el job con el secreto correcto", async () => {
    vi.mocked(notifyFavorites).mockResolvedValue({ evaluated: 3, sent: 1 });

    const app = Fastify();
    await registerInternalNotifyRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/internal/notify-favorites",
      headers: { "x-internal-secret": "super-secreto" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ evaluated: 3, sent: 1 });
    expect(notifyFavorites).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
});
