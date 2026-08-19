import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
}));

import { __clearMemoryCache } from "../lib/cache.js";
import { askFollowUp, parseQueryIntent, rankSpots, recommendAlternatives } from "./claude.js";

const PAYLOAD = {
  sport: "running" as const,
  spotName: "Parque de Santa Margarita",
  score: 90,
  scoreBand: "green" as const,
  weather: {
    rainYesterdayMm: 0,
    rainTodayMm: 0,
    windAvgTodayKmh: 5,
    windMaxTodayKmh: 8,
    windDirectionMiddayDeg: 90,
    temperatureAvgTodayC: 18,
  },
};

const NEARBY = [
  {
    spotId: "way/9",
    spotName: "Playa de Riazor",
    score: 80,
    distanceKm: 3.2,
    weather: PAYLOAD.weather,
  },
];

describe("recommendAlternatives", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    // La IA se cachea por payload: sin esto un test reutiliza la respuesta del anterior.
    __clearMemoryCache();
  });

  it("devuelve el veredicto y las alternativas del tool_use", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "recomendar_alternativas",
          input: {
            verdict: "Recibe viento de costado de 38 km/h.",
            alternatives: [{ spot_id: "way/9", why: "A 3,2 km y resguardada del norte." }],
          },
        },
      ],
    });

    const result = await recommendAlternatives(PAYLOAD, NEARBY);

    expect(result).toEqual({
      verdict: "Recibe viento de costado de 38 km/h.",
      alternatives: [{ spotId: "way/9", why: "A 3,2 km y resguardada del norte." }],
    });
  });

  it("descarta las zonas que Claude no haya sacado del payload", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: {
            verdict: "v",
            alternatives: [
              { spot_id: "way/9", why: "existe en el payload" },
              { spot_id: "way/inventada", why: "esta no estaba" },
            ],
          },
        },
      ],
    });

    const result = await recommendAlternatives(PAYLOAD, NEARBY);

    // No puede colar una playa que no exista: solo pasan los ids del payload.
    expect(result.alternatives).toEqual([{ spotId: "way/9", why: "existe en el payload" }]);
  });

  it("lanza un error legible si Claude no devuelve tool_use", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "no debería pasar" }] });

    await expect(recommendAlternatives(PAYLOAD, NEARBY)).rejects.toThrow("Claude no devolvió alternativas estructuradas");
  });
});

describe("askFollowUp", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    // La IA se cachea por payload: sin esto un test reutiliza la respuesta del anterior.
    __clearMemoryCache();
  });

  it("incluye el grounding payload y el historial en la llamada", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Sí, hay sombra por la tarde en la zona norte del parque." }],
    });

    const answer = await askFollowUp(PAYLOAD, [{ role: "user", content: "¿hay parking cerca?" }], "¿y sombra?");

    expect(answer).toBe("Sí, hay sombra por la tarde en la zona norte del parque.");
    const call = mockCreate.mock.calls[0][0];
    expect(call.messages.at(-1)).toEqual({ role: "user", content: "¿y sombra?" });
    expect(call.messages[0].content).toContain(PAYLOAD.spotName);
  });

  it("lanza un error legible si Claude no devuelve texto", async () => {
    mockCreate.mockResolvedValue({ content: [] });

    await expect(askFollowUp(PAYLOAD, [], "¿algo más?")).rejects.toThrow("Claude no devolvió una respuesta de texto");
  });
});

describe("parseQueryIntent", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    // La IA se cachea por payload: sin esto un test reutiliza la respuesta del anterior.
    __clearMemoryCache();
  });

  it("mapea los campos snake_case del tool_use a la forma camelCase", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "extraer_intencion",
          input: {
            sport: "playa",
            locality_text: "Vigo",
            require_dogs_allowed: true,
          },
        },
      ],
    });

    const intent = await parseQueryIntent("quiero ir a la playa en Vigo con el perro");

    expect(intent).toEqual({
      sport: "playa",
      localityText: "Vigo",
      filters: { requireDogsAllowed: true, requireNaturist: undefined, excludeNaturist: undefined },
    });
  });

  it("lanza un error legible si Claude no devuelve tool_use", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "no debería pasar" }] });

    await expect(parseQueryIntent("algo ambiguo")).rejects.toThrow("Claude no pudo interpretar la petición");
  });
});

describe("rankSpots", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    // La IA se cachea por payload: sin esto un test reutiliza la respuesta del anterior.
    __clearMemoryCache();
  });

  it("mapea spot_id a spotId en cada entrada del ranking", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "rankear_zonas",
          input: {
            rankings: [
              { spot_id: "way/2", headline: "La mejor hoy", reasoning: "Sin viento y con oleaje suave." },
              { spot_id: "way/1", headline: "Segunda opción", reasoning: "Algo más de viento." },
            ],
          },
        },
      ],
    });

    const result = await rankSpots("quiero playa en Vigo", "playa", [
      { spotId: "way/1", spotName: "Praia A", score: 60, scoreBand: "yellow", weather: PAYLOAD.weather },
      { spotId: "way/2", spotName: "Praia B", score: 90, scoreBand: "green", weather: PAYLOAD.weather },
    ]);

    expect(result).toEqual([
      { spotId: "way/2", headline: "La mejor hoy", reasoning: "Sin viento y con oleaje suave." },
      { spotId: "way/1", headline: "Segunda opción", reasoning: "Algo más de viento." },
    ]);
  });

  it("lanza un error legible si Claude no devuelve tool_use", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "no debería pasar" }] });

    await expect(rankSpots("texto", "running", [])).rejects.toThrow("Claude no devolvió un ranking estructurado");
  });
});

describe("caché de respuestas de la IA", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    __clearMemoryCache();
  });

  it("no vuelve a llamar a Claude si el payload es idéntico (abrir el mismo pin dos veces)", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", input: { verdict: "v", alternatives: [] } }],
    });

    await recommendAlternatives(PAYLOAD, NEARBY);
    await recommendAlternatives(PAYLOAD, NEARBY);
    await recommendAlternatives(PAYLOAD, NEARBY);

    // Sin caché esto eran tres llamadas a Opus facturadas.
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("sí vuelve a llamar cuando cambian los datos (otro score, otra meteo)", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", input: { verdict: "v", alternatives: [] } }],
    });

    await recommendAlternatives(PAYLOAD, NEARBY);
    await recommendAlternatives({ ...PAYLOAD, score: 40, scoreBand: "yellow" as const }, NEARBY);

    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("no cachea los errores: un fallo transitorio no queda servido durante horas", async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "sin tool_use" }] });
    await expect(recommendAlternatives(PAYLOAD, NEARBY)).rejects.toThrow();

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "tool_use", input: { verdict: "ok", alternatives: [] } }],
    });
    await expect(recommendAlternatives(PAYLOAD, NEARBY)).resolves.toMatchObject({ verdict: "ok" });
  });
});
