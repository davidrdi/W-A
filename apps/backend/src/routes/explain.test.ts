import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/weather.js", () => ({
  getWeatherSnapshots: vi.fn(),
}));
vi.mock("../services/claude.js", () => ({
  explainSpot: vi.fn(),
  askFollowUp: vi.fn(),
}));

import { askFollowUp, explainSpot } from "../services/claude.js";
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

  it("calcula el score en el backend y solo le pide a Claude la explicación", async () => {
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY]);
    vi.mocked(explainSpot).mockResolvedValue({
      headline: "Buen día para correr",
      reasoning: "Sin lluvia y con poco viento.",
      cautions: [],
    });

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
    expect(body.headline).toBe("Buen día para correr");
    expect(body.groundingPayload.spotName).toBe("Parque de Santa Margarita");

    // Claude nunca decide el score: se le pasa ya calculado por el backend.
    expect(explainSpot).toHaveBeenCalledWith(
      expect.objectContaining({ score: 100, scoreBand: "green", spotName: "Parque de Santa Margarita" }),
    );
  });

  it("rechaza payload inválido", async () => {
    const app = Fastify();
    await registerExplainRoute(app);

    const response = await app.inject({ method: "POST", url: "/explain", payload: { sport: "running" } });

    expect(response.statusCode).toBe(400);
    expect(explainSpot).not.toHaveBeenCalled();
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
          scoreBand: "amber",
          weather: CLEAR_DAY,
        },
        priorMessages: [],
        question: "",
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
