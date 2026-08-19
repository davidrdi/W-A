import { describe, expect, it } from "vitest";
import { describeFetchError } from "./fetchError.js";

describe("describeFetchError", () => {
  it("expone la causa real detrás de un 'fetch failed' genérico de undici", () => {
    const dnsFailure = new Error("getaddrinfo ENOTFOUND overpass-api.de");
    const fetchFailed = new Error("fetch failed", { cause: dnsFailure });

    expect(describeFetchError(fetchFailed)).toBe("fetch failed ← getaddrinfo ENOTFOUND overpass-api.de");
  });

  it("recorre varios niveles de causa encadenada", () => {
    const root = new Error("ECONNREFUSED");
    const middle = new Error("connect failed", { cause: root });
    const top = new Error("fetch failed", { cause: middle });

    expect(describeFetchError(top)).toBe("fetch failed ← connect failed ← ECONNREFUSED");
  });

  it("no revienta si no hay causa", () => {
    expect(describeFetchError(new Error("timeout"))).toBe("timeout");
  });

  it("no revienta con algo que no es un Error", () => {
    expect(describeFetchError("boom")).toBe("error de red");
  });
});
