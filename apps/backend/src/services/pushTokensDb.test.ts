import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

import { listPushTokensByUserIds, upsertPushToken } from "./pushTokensDb.js";

function chainable(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "upsert", "in"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

describe("upsertPushToken", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("hace upsert por (user_id, token)", async () => {
    const chain = chainable({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await upsertPushToken("user-1", "ExponentPushToken[abc]");

    expect(chain.upsert).toHaveBeenCalledWith(
      { user_id: "user-1", token: "ExponentPushToken[abc]" },
      { onConflict: "user_id,token" },
    );
  });
});

describe("listPushTokensByUserIds", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("agrupa los tokens por user_id", async () => {
    mockFrom.mockReturnValue(
      chainable({
        data: [
          { user_id: "user-1", token: "tok-a" },
          { user_id: "user-1", token: "tok-b" },
          { user_id: "user-2", token: "tok-c" },
        ],
        error: null,
      }),
    );

    const byUser = await listPushTokensByUserIds(["user-1", "user-2"]);

    expect(byUser).toEqual({ "user-1": ["tok-a", "tok-b"], "user-2": ["tok-c"] });
  });

  it("devuelve un objeto vacío sin llamar a Supabase si no hay user_ids", async () => {
    const byUser = await listPushTokensByUserIds([]);
    expect(byUser).toEqual({});
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
