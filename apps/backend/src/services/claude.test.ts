import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
}));

import { askFollowUp, explainSpot } from "./claude.js";

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
