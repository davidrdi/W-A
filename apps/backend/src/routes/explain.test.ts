import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/weather.js", () => ({
  getWeatherSnapshots: vi.fn(),
}));
vi.mock("../services/marine.js", () => ({
  getMarineSnapshots: vi.fn(),
}));
vi.mock("../services/claude.js", () => ({
  recommendAlternatives: vi.fn(),
  askFollowUp: vi.fn(),
}));

import { askFollowUp, recommendAlternatives } from "../services/claude.js";
import { getMarineSnapshots } from "../services/marine.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { registerExplainRoute } from "./explain.js";

const CLEAR_DAY = {
  rainYesterdayMm: 0,
  rainTodayMm: 0,
  windAvgTodayKmh: 5,
  windMaxTodayKmh: 8,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 18,
};

describe("POST /explain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("diagnostica sin llamar a la IA: score, titular y factores salen del scoring", async () => {
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY]);

    const app = Fastify();
    await registerExplainRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/explain",
      payload: { sport: "running", spotId: "way/1", name: "Parque de Santa Margarita", lat: 43.37, lon: -8.4 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.score).toBe(100);
    expect(body.scoreBand).toBe("green");
    expect(body.headline).toBe("Buenas condiciones");
    expect(Array.isArray(body.factors)).toBe(true);
    expect(body.groundingPayload.spotName).toBe("Parque de Santa Margarita");

    // La ficha de la zona no cuesta ni una llamada a la IA.
    expect(recommendAlternatives).not.toHaveBeenCalled();
  });

  it("rechaza payload inválido", async () => {
    const app = Fastify();
    await registerExplainRoute(app);

    const response = await app.inject({ method: "POST", url: "/explain", payload: { sport: "running" } });

    expect(response.statusCode).toBe(400);
    expect(recommendAlternatives).not.toHaveBeenCalled();
  });

  it("para un deporte de agua, pide datos marinos y los incluye en el grounding payload", async () => {
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY]);
    vi.mocked(getMarineSnapshots).mockResolvedValue([
      { waveHeightAvgM: 1.2, waveHeightMaxM: 1.5, seaSurfaceTempC: 18 },
    ]);

    const app = Fastify();
    await registerExplainRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/explain",
      payload: { sport: "surf", spotId: "way/9", name: "Praia de Riazor", lat: 43.37, lon: -8.41 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().groundingPayload.marine).toEqual({
      waveHeightAvgM: 1.2,
      waveHeightMaxM: 1.5,
      seaSurfaceTempC: 18,
    });
    // El oleaje entra en el diagnóstico determinista, sin pasar por la IA.
    expect(response.json().factors.some((f: { label: string }) => /ola|oleaje/i.test(f.label))).toBe(true);
  });
});

describe("POST /explain/followup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reenvía el grounding payload y el historial a Claude", async () => {
    vi.mocked(askFollowUp).mockResolvedValue("Sí, hay sombra por la tarde.");

    const app = Fastify();
    await registerExplainRoute(app);

    const groundingPayload = {
      sport: "running",
      spotName: "Parque de Santa Margarita",
      score: 90,
      scoreBand: "green",
      weather: CLEAR_DAY,
    };

    const response = await app.inject({
      method: "POST",
      url: "/explain/followup",
      payload: { groundingPayload, priorMessages: [], question: "¿Hay sombra por la tarde?" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ answer: "Sí, hay sombra por la tarde." });
    expect(askFollowUp).toHaveBeenCalledWith(groundingPayload, [], "¿Hay sombra por la tarde?");
  });

  it("rechaza una pregunta vacía", async () => {
    const app = Fastify();
    await registerExplainRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/explain/followup",
      payload: {
        groundingPayload: {
          sport: "running",
          spotName: "X",
          score: 50,
          scoreBand: "yellow",
          weather: CLEAR_DAY,
        },
        priorMessages: [],
        question: "",
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
