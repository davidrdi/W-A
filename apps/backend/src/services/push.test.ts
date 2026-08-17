import { afterEach, describe, expect, it, vi } from "vitest";
import { sendExpoPushNotifications } from "./push.js";

describe("sendExpoPushNotifications", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("manda un POST con el array de mensajes tal cual", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await sendExpoPushNotifications([{ to: "ExponentPushToken[abc]", title: "Hola", body: "Buen día" }]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify([{ to: "ExponentPushToken[abc]", title: "Hola", body: "Buen día" }]),
      }),
    );
  });

  it("no llama a fetch si no hay mensajes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await sendExpoPushNotifications([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lanza un error legible si Expo Push responde con un status de error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(sendExpoPushNotifications([{ to: "x", title: "x", body: "x" }])).rejects.toThrow(
      "Expo Push respondió 429",
    );
  });
});
