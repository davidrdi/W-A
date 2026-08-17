import { describe, expect, it } from "vitest";
import { scoreBandFor, scoreRunning } from "./rules.js";

const CLEAR_DAY = {
  rainYesterdayMm: 0,
  rainTodayMm: 0,
  windAvgTodayKmh: 8,
  windMaxTodayKmh: 12,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 16,
};

describe("scoreRunning", () => {
  it("da la puntuación máxima en un día seco, templado y sin viento", () => {
    expect(scoreRunning(CLEAR_DAY)).toBe(100);
  });

  it("penaliza la lluvia de ayer (barro) más que un día completamente seco", () => {
    const muddyYesterday = { ...CLEAR_DAY, rainYesterdayMm: 15 };
    expect(scoreRunning(muddyYesterday)).toBeLessThan(scoreRunning(CLEAR_DAY));
  });

  it("penaliza más llover hoy que haber llovido ayer, a igualdad de mm", () => {
    const rainToday = { ...CLEAR_DAY, rainTodayMm: 10 };
    const rainYesterday = { ...CLEAR_DAY, rainYesterdayMm: 10 };
    expect(scoreRunning(rainToday)).toBeLessThan(scoreRunning(rainYesterday));
  });

  it("penaliza el viento fuerte por encima del umbral cómodo", () => {
    const windy = { ...CLEAR_DAY, windMaxTodayKmh: 45 };
    expect(scoreRunning(windy)).toBeLessThan(scoreRunning(CLEAR_DAY));
  });

  it("penaliza tanto el calor como el frío extremos", () => {
    const hot = { ...CLEAR_DAY, temperatureAvgTodayC: 34 };
    const cold = { ...CLEAR_DAY, temperatureAvgTodayC: -2 };
    expect(scoreRunning(hot)).toBeLessThan(scoreRunning(CLEAR_DAY));
    expect(scoreRunning(cold)).toBeLessThan(scoreRunning(CLEAR_DAY));
  });

  it("nunca baja de 0 aunque se acumulen todas las penalizaciones", () => {
    const terrible = {
      rainYesterdayMm: 50,
      rainTodayMm: 50,
      windAvgTodayKmh: 60,
      windMaxTodayKmh: 90,
      windDirectionMiddayDeg: 0,
      temperatureAvgTodayC: 40,
    };
    expect(scoreRunning(terrible)).toBe(0);
  });
});

describe("scoreBandFor", () => {
  it("clasifica en verde, ámbar o rojo según los umbrales", () => {
    expect(scoreBandFor(100)).toBe("green");
    expect(scoreBandFor(70)).toBe("green");
    expect(scoreBandFor(69)).toBe("amber");
    expect(scoreBandFor(40)).toBe("amber");
    expect(scoreBandFor(39)).toBe("red");
    expect(scoreBandFor(0)).toBe("red");
  });
});
