import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
}));

import { askFollowUp, explainSpot, parseQueryIntent, rankSpots } from "./claude.js";

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

describe("explainSpot", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("devuelve los campos del tool_use de Claude", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "explicar_zona",
          input: { headline: "Buen día para correr", reasoning: "Sin lluvia y con poco viento.", cautions: [] },
        },
      ],
    });

    const result = await explainSpot(PAYLOAD);

    expect(result).toEqual({
      headline: "Buen día para correr",
      reasoning: "Sin lluvia y con poco viento.",
      cautions: [],
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_choice: { type: "tool", name: "explicar_zona" },
        messages: [{ role: "user", content: JSON.stringify(PAYLOAD) }],
      }),
    );
  });

  it("lanza un error legible si Claude no devuelve tool_use", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "no debería pasar" }] });

    await expect(explainSpot(PAYLOAD)).rejects.toThrow("Claude no devolvió una explicación estructurada");
  });
});

describe("askFollowUp", () => {
  beforeEach(() => {
    mockCreate.mockReset();
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
      { spotId: "way/1", spotName: "Praia A", score: 60, scoreBand: "amber", weather: PAYLOAD.weather },
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
