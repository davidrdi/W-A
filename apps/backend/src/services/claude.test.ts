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

describe("logging de usage", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("emite una línea claude_usage con tokens y coste estimado por llamada", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "explicar_zona",
          input: { headline: "Buen día", reasoning: "Sin lluvia.", cautions: [] },
        },
      ],
      usage: { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    });

    await explainSpot(PAYLOAD);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toEqual({
      event: "claude_usage",
      operation: "explainSpot",
      model: "claude-opus-5",
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      // 1000 * $5/1M + 500 * $25/1M
      estimatedCostUsd: 0.0175,
    });

    logSpy.mockRestore();
  });

  it("no rompe si la respuesta no trae usage", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "explicar_zona",
          input: { headline: "Buen día", reasoning: "Sin lluvia.", cautions: [] },
        },
      ],
    });

    await expect(explainSpot(PAYLOAD)).resolves.toMatchObject({ headline: "Buen día" });
    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
