import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./favoritesDb.js", () => ({ listAllFavorites: vi.fn(), markFavoriteNotified: vi.fn() }));
vi.mock("./pushTokensDb.js", () => ({ listPushTokensByUserIds: vi.fn() }));
vi.mock("./push.js", () => ({ sendExpoPushNotifications: vi.fn() }));
vi.mock("./weather.js", () => ({ getWeatherSnapshots: vi.fn() }));
vi.mock("./marine.js", () => ({ getMarineSnapshots: vi.fn() }));

import { listAllFavorites, markFavoriteNotified } from "./favoritesDb.js";
import { notifyFavorites } from "./favoritesNotifier.js";
import { getMarineSnapshots } from "./marine.js";
import { listPushTokensByUserIds } from "./pushTokensDb.js";
import { sendExpoPushNotifications } from "./push.js";
import { getWeatherSnapshots } from "./weather.js";

const CLEAR_DAY = {
  rainYesterdayMm: 0,
  rainTodayMm: 0,
  windAvgTodayKmh: 5,
  windMaxTodayKmh: 8,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 18,
};

const MUDDY_DAY = { ...CLEAR_DAY, rainYesterdayMm: 30, rainTodayMm: 20 };

describe("notifyFavorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no procesa favoritos ya evaluados hoy", async () => {
    vi.mocked(listAllFavorites).mockResolvedValue([
      {
        id: "fav-1",
        userId: "user-1",
        spotId: "way/1",
        spotName: "Parque X",
        sport: "running",
        lat: 1,
        lon: 1,
        lastNotifiedDate: "2026-08-17",
      },
    ]);

    const result = await notifyFavorites("2026-08-17");

    expect(result).toEqual({ evaluated: 0, sent: 0 });
    expect(getWeatherSnapshots).not.toHaveBeenCalled();
  });

  it("manda push solo si el score es verde, y marca el favorito como notificado en cualquier caso", async () => {
    vi.mocked(listAllFavorites).mockResolvedValue([
      {
        id: "fav-good",
        userId: "user-1",
        spotId: "way/1",
        spotName: "Parque Bueno",
        sport: "running",
        lat: 1,
        lon: 1,
        lastNotifiedDate: null,
      },
      {
        id: "fav-bad",
        userId: "user-1",
        spotId: "way/2",
        spotName: "Parque Embarrado",
        sport: "running",
        lat: 2,
        lon: 2,
        lastNotifiedDate: null,
      },
    ]);
    vi.mocked(listPushTokensByUserIds).mockResolvedValue({ "user-1": ["tok-a"] });
    vi.mocked(getWeatherSnapshots).mockResolvedValueOnce([CLEAR_DAY]).mockResolvedValueOnce([MUDDY_DAY]);

    const result = await notifyFavorites("2026-08-17");

    expect(result).toEqual({ evaluated: 2, sent: 1 });
    expect(sendExpoPushNotifications).toHaveBeenCalledTimes(1);
    expect(sendExpoPushNotifications).toHaveBeenCalledWith([
      expect.objectContaining({ to: "tok-a", title: expect.stringContaining("Parque Bueno") }),
    ]);
    expect(markFavoriteNotified).toHaveBeenCalledWith("fav-good", "2026-08-17");
    expect(markFavoriteNotified).toHaveBeenCalledWith("fav-bad", "2026-08-17");
  });

  it("pide datos marinos solo para deportes de agua", async () => {
    vi.mocked(listAllFavorites).mockResolvedValue([
      {
        id: "fav-surf",
        userId: "user-1",
        spotId: "way/9",
        spotName: "Praia",
        sport: "surf",
        lat: 1,
        lon: 1,
        lastNotifiedDate: null,
      },
    ]);
    vi.mocked(listPushTokensByUserIds).mockResolvedValue({ "user-1": ["tok-a"] });
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY]);
    vi.mocked(getMarineSnapshots).mockResolvedValue([{ waveHeightAvgM: 1.2, waveHeightMaxM: 1.5, seaSurfaceTempC: 18 }]);

    await notifyFavorites("2026-08-17");

    expect(getMarineSnapshots).toHaveBeenCalledWith([{ lat: 1, lon: 1 }]);
  });

  it("no llama a Expo Push ni a meteo si el usuario no tiene ningún token registrado", async () => {
    vi.mocked(listAllFavorites).mockResolvedValue([
      {
        id: "fav-1",
        userId: "user-sin-token",
        spotId: "way/1",
        spotName: "Parque X",
        sport: "running",
        lat: 1,
        lon: 1,
        lastNotifiedDate: null,
      },
    ]);
    vi.mocked(listPushTokensByUserIds).mockResolvedValue({});

    const result = await notifyFavorites("2026-08-17");

    expect(result).toEqual({ evaluated: 1, sent: 0 });
    expect(getWeatherSnapshots).not.toHaveBeenCalled();
    expect(sendExpoPushNotifications).not.toHaveBeenCalled();
    expect(markFavoriteNotified).toHaveBeenCalledWith("fav-1", "2026-08-17");
  });
});
