import { describe, expect, it, vi } from "vitest";

vi.mock("../services/supabaseAdmin.js", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getSupabaseAdmin } from "../services/supabaseAdmin.js";
import { requireAuth } from "./auth.js";

function fakeReply() {
  const reply: { status: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; statusCode?: number } = {
    status: vi.fn(function (this: typeof reply, code: number) {
      this.statusCode = code;
      return this;
    }),
    send: vi.fn(),
  };
  return reply as unknown as import("fastify").FastifyReply & { statusCode?: number };
}

describe("requireAuth", () => {
  it("rechaza con 401 si no hay cabecera Authorization", async () => {
    const request = { headers: {} } as import("fastify").FastifyRequest;
    const reply = fakeReply();

    await requireAuth(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(request.userId).toBeUndefined();
  });

  it("rechaza con 401 si el token no es válido", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "invalid" } }) },
    } as never);

    const request = { headers: { authorization: "Bearer token-malo" } } as import("fastify").FastifyRequest;
    const reply = fakeReply();

    await requireAuth(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it("con un token válido, adjunta el userId verificado a la request", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
    } as never);

    const request = { headers: { authorization: "Bearer token-bueno" } } as import("fastify").FastifyRequest;
    const reply = fakeReply();

    await requireAuth(request, reply);

    expect(request.userId).toBe("user-1");
    expect(reply.status).not.toHaveBeenCalled();
  });
});
