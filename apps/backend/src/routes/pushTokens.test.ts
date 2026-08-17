import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.js", () => ({
  requireAuth: vi.fn(async (request: import("fastify").FastifyRequest) => {
    request.userId = "user-1";
  }),
}));
vi.mock("../services/pushTokensDb.js", () => ({ upsertPushToken: vi.fn() }));

import { upsertPushToken } from "../services/pushTokensDb.js";
import { registerPushTokensRoute } from "./pushTokens.js";

describe("POST /push-tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guarda el token del usuario autenticado", async () => {
    const app = Fastify();
    await registerPushTokensRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/push-tokens",
      headers: { authorization: "Bearer x" },
      payload: { expoPushToken: "ExponentPushToken[abc]" },
    });

    expect(response.statusCode).toBe(204);
    expect(upsertPushToken).toHaveBeenCalledWith("user-1", "ExponentPushToken[abc]");
  });

  it("rechaza payload sin token", async () => {
    const app = Fastify();
    await registerPushTokensRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/push-tokens",
      headers: { authorization: "Bearer x" },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(upsertPushToken).not.toHaveBeenCalled();
  });
});
