import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

import { createFavorite, deleteFavorite, listAllFavorites, listFavorites, markFavoriteNotified } from "./favoritesDb.js";

// La query builder de supabase-js encadena métodos y el resultado final es
// "thenable" — este mock replica eso: cada método devuelve la propia
// cadena, y resolver el `await` dispara `.then` con el resultado dado.
function chainable(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "upsert", "delete", "single", "update"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

const ROW = {
  id: "fav-1",
  spot_id: "way/1",
  spot_name: "Parque de Santa Margarita",
  sport: "running",
  lat: 43.37,
  lon: -8.4,
  created_at: "2026-08-17T10:00:00Z",
};

describe("listFavorites", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("mapea las filas a camelCase y filtra por user_id", async () => {
    const chain = chainable({ data: [ROW], error: null });
    mockFrom.mockReturnValue(chain);

    const favorites = await listFavorites("user-1");

    expect(favorites).toEqual([
      { id: "fav-1", spotId: "way/1", spotName: "Parque de Santa Margarita", sport: "running", lat: 43.37, lon: -8.4, createdAt: "2026-08-17T10:00:00Z" },
    ]);
    expect(mockFrom).toHaveBeenCalledWith("favorites");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("lanza un error legible si Supabase responde con error", async () => {
    mockFrom.mockReturnValue(chainable({ data: null, error: { message: "boom" } }));

    await expect(listFavorites("user-1")).rejects.toThrow("Supabase respondió con error al listar favoritos: boom");
  });
});

describe("createFavorite", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("hace upsert por (user_id, spot_id, sport) y devuelve el favorito creado", async () => {
    const chain = chainable({ data: ROW, error: null });
    mockFrom.mockReturnValue(chain);

    const favorite = await createFavorite("user-1", {
      spotId: "way/1",
      spotName: "Parque de Santa Margarita",
      sport: "running",
      lat: 43.37,
      lon: -8.4,
    });

    expect(favorite.id).toBe("fav-1");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", spot_id: "way/1", sport: "running" }),
      { onConflict: "user_id,spot_id,sport" },
    );
  });
});

describe("deleteFavorite", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("filtra por id Y user_id (no se puede borrar el favorito de otro usuario)", async () => {
    const chain = chainable({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await deleteFavorite("user-1", "fav-1");

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenNthCalledWith(1, "id", "fav-1");
    expect(chain.eq).toHaveBeenNthCalledWith(2, "user_id", "user-1");
  });
});

describe("listAllFavorites (para el job de notificaciones)", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("mapea también user_id y last_notified_date", async () => {
    mockFrom.mockReturnValue(
      chainable({ data: [{ ...ROW, user_id: "user-1", last_notified_date: "2026-08-16" }], error: null }),
    );

    const favorites = await listAllFavorites();

    expect(favorites).toEqual([
      {
        id: "fav-1",
        userId: "user-1",
        spotId: "way/1",
        spotName: "Parque de Santa Margarita",
        sport: "running",
        lat: 43.37,
        lon: -8.4,
        lastNotifiedDate: "2026-08-16",
      },
    ]);
  });
});

describe("markFavoriteNotified", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("actualiza last_notified_date del favorito indicado", async () => {
    const chain = chainable({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await markFavoriteNotified("fav-1", "2026-08-17");

    expect(chain.update).toHaveBeenCalledWith({ last_notified_date: "2026-08-17" });
    expect(chain.eq).toHaveBeenCalledWith("id", "fav-1");
  });
});
