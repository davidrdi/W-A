import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.js", () => ({
  requireAuth: vi.fn(async (request: import("fastify").FastifyRequest) => {
    request.userId = "user-1";
  }),
}));
vi.mock("../services/favoritesDb.js", () => ({
  listFavorites: vi.fn(),
  createFavorite: vi.fn(),
  deleteFavorite: vi.fn(),
}));

import { requireAuth } from "../lib/auth.js";
import { createFavorite, deleteFavorite, listFavorites } from "../services/favoritesDb.js";
import { registerFavoritesRoute } from "./favorites.js";

const FAVORITE = {
  id: "fav-1",
  spotId: "way/1",
  spotName: "Parque de Santa Margarita",
  sport: "running" as const,
  lat: 43.37,
  lon: -8.4,
  createdAt: "2026-08-17T10:00:00Z",
};

describe("GET /favorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve los favoritos del usuario autenticado", async () => {
    vi.mocked(listFavorites).mockResolvedValue([FAVORITE]);

    const app = Fastify();
    await registerFavoritesRoute(app);

    const response = await app.inject({ method: "GET", url: "/favorites", headers: { authorization: "Bearer x" } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ favorites: [FAVORITE] });
    expect(listFavorites).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /favorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea el favorito para el usuario autenticado", async () => {
    vi.mocked(createFavorite).mockResolvedValue(FAVORITE);

    const app = Fastify();
    await registerFavoritesRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/favorites",
      headers: { authorization: "Bearer x" },
      payload: { spotId: "way/1", spotName: "Parque de Santa Margarita", sport: "running", lat: 43.37, lon: -8.4 },
    });

    expect(response.statusCode).toBe(200);
    expect(createFavorite).toHaveBeenCalledWith("user-1", {
      spotId: "way/1",
      spotName: "Parque de Santa Margarita",
      sport: "running",
      lat: 43.37,
      lon: -8.4,
    });
  });

  it("rechaza payload inválido antes de tocar la base de datos", async () => {
    const app = Fastify();
    await registerFavoritesRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/favorites",
      headers: { authorization: "Bearer x" },
      payload: { spotId: "way/1" },
    });

    expect(response.statusCode).toBe(400);
    expect(createFavorite).not.toHaveBeenCalled();
  });
});

describe("DELETE /favorites/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("borra el favorito del usuario autenticado", async () => {
    const app = Fastify();
    await registerFavoritesRoute(app);

    const response = await app.inject({
      method: "DELETE",
      url: "/favorites/fav-1",
      headers: { authorization: "Bearer x" },
    });

    expect(response.statusCode).toBe(204);
    expect(deleteFavorite).toHaveBeenCalledWith("user-1", "fav-1");
  });
});

describe("sin autenticación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simula que requireAuth corta la petición con 401 (comportamiento real).
    vi.mocked(requireAuth).mockImplementation(async (_request, reply) => {
      return reply.status(401).send({ error: "Falta el token de autenticación" });
    });
  });

  it("no llega a listFavorites si requireAuth rechaza la petición", async () => {
    const app = Fastify();
    await registerFavoritesRoute(app);

    const response = await app.inject({ method: "GET", url: "/favorites" });

    expect(response.statusCode).toBe(401);
    expect(listFavorites).not.toHaveBeenCalled();
  });
});
