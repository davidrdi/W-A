import { describe, expect, it } from "vitest";
import {
  scoreBandFor,
  scoreBici,
  scoreLandSport,
  scorePaseo,
  scorePlaya,
  scoreRunning,
  scoreSenderismo,
  scoreSurf,
  scoreWaterSport,
  scoreWindsurf,
} from "./rules.js";

const CLEAR_DAY = {
  rainYesterdayMm: 0,
  rainTodayMm: 0,
  windAvgTodayKmh: 8,
  windMaxTodayKmh: 12,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 16,
};

const BEACH_DAY = {
  rainYesterdayMm: 0,
  rainTodayMm: 0,
  windAvgTodayKmh: 10,
  windMaxTodayKmh: 15,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 27,
};

const FLAT_SEA = { waveHeightAvgM: 0.1, waveHeightMaxM: 0.15, seaSurfaceTempC: 19 };
const GOOD_SURF_SEA = { waveHeightAvgM: 1.2, waveHeightMaxM: 1.5, seaSurfaceTempC: 18 };

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

describe("scorePaseo", () => {
  it("es más tolerante que running con el barro de ayer", () => {
    const muddyYesterday = { ...CLEAR_DAY, rainYesterdayMm: 15 };
    const paseoDrop = scorePaseo(CLEAR_DAY) - scorePaseo(muddyYesterday);
    const runningDrop = scoreRunning(CLEAR_DAY) - scoreRunning(muddyYesterday);
    expect(paseoDrop).toBeLessThan(runningDrop);
  });

  it("penaliza fuerte llover hoy mismo", () => {
    const rainingNow = { ...CLEAR_DAY, rainTodayMm: 8 };
    expect(scorePaseo(rainingNow)).toBeLessThan(scorePaseo(CLEAR_DAY));
  });
});

describe("scoreSenderismo", () => {
  it("penaliza el barro de ayer más que running (sendero de tierra vs asfalto)", () => {
    const muddyYesterday = { ...CLEAR_DAY, rainYesterdayMm: 15 };
    const senderismoDrop = scoreSenderismo(CLEAR_DAY) - scoreSenderismo(muddyYesterday);
    const runningDrop = scoreRunning(CLEAR_DAY) - scoreRunning(muddyYesterday);
    expect(senderismoDrop).toBeGreaterThan(runningDrop);
  });

  it("penaliza el viento fuerte (cresta/altura)", () => {
    const windy = { ...CLEAR_DAY, windMaxTodayKmh: 50 };
    expect(scoreSenderismo(windy)).toBeLessThan(scoreSenderismo(CLEAR_DAY));
  });
});

describe("scoreBici", () => {
  it("penaliza mucho el firme mojado de hoy", () => {
    const wetToday = { ...CLEAR_DAY, rainTodayMm: 8 };
    expect(scoreBici(wetToday)).toBeLessThan(scoreBici(CLEAR_DAY));
  });

  it("penaliza el viento fuerte más que la lluvia de ayer, a igualdad de severidad relativa", () => {
    const windy = { ...CLEAR_DAY, windMaxTodayKmh: 55 };
    const muddyYesterday = { ...CLEAR_DAY, rainYesterdayMm: 15 };
    expect(scoreBici(windy)).toBeLessThan(scoreBici(muddyYesterday));
  });
});

describe("scorePlaya", () => {
  it("da buena puntuación en un día cálido, seco y con mar en calma", () => {
    expect(scorePlaya(BEACH_DAY, FLAT_SEA)).toBeGreaterThanOrEqual(70);
  });

  it("penaliza el frío mucho más que scoreRunning (playa quiere calor)", () => {
    const cold = { ...BEACH_DAY, temperatureAvgTodayC: 14 };
    expect(scorePlaya(cold, FLAT_SEA)).toBeLessThan(scorePlaya(BEACH_DAY, FLAT_SEA));
  });

  it("penaliza llover hoy y el oleaje alto", () => {
    const rainy = { ...BEACH_DAY, rainTodayMm: 6 };
    expect(scorePlaya(rainy, FLAT_SEA)).toBeLessThan(scorePlaya(BEACH_DAY, FLAT_SEA));
    expect(scorePlaya(BEACH_DAY, GOOD_SURF_SEA)).toBeLessThan(scorePlaya(BEACH_DAY, FLAT_SEA));
  });
});

describe("scoreSurf", () => {
  it("puntúa mejor un oleaje aprovechable que un mar completamente plano", () => {
    expect(scoreSurf(BEACH_DAY, GOOD_SURF_SEA)).toBeGreaterThan(scoreSurf(BEACH_DAY, FLAT_SEA));
  });

  it("penaliza el viento muy fuerte que desordena las olas", () => {
    const windy = { ...BEACH_DAY, windMaxTodayKmh: 60 };
    expect(scoreSurf(windy, GOOD_SURF_SEA)).toBeLessThan(scoreSurf(BEACH_DAY, GOOD_SURF_SEA));
  });
});

describe("scoreWindsurf", () => {
  it("puntúa mejor viento moderado-fuerte que calma total", () => {
    const windyEnough = { ...BEACH_DAY, windAvgTodayKmh: 24, windMaxTodayKmh: 30 };
    const calm = { ...BEACH_DAY, windAvgTodayKmh: 4, windMaxTodayKmh: 6 };
    expect(scoreWindsurf(windyEnough, FLAT_SEA)).toBeGreaterThan(scoreWindsurf(calm, FLAT_SEA));
  });
});

describe("scoreLandSport / scoreWaterSport (dispatchers)", () => {
  it("enruta cada deporte de tierra a su función correspondiente", () => {
    expect(scoreLandSport("running", CLEAR_DAY)).toBe(scoreRunning(CLEAR_DAY));
    expect(scoreLandSport("paseo", CLEAR_DAY)).toBe(scorePaseo(CLEAR_DAY));
    expect(scoreLandSport("senderismo", CLEAR_DAY)).toBe(scoreSenderismo(CLEAR_DAY));
    expect(scoreLandSport("bici", CLEAR_DAY)).toBe(scoreBici(CLEAR_DAY));
  });

  it("lanza un error legible si se le pasa un deporte de agua", () => {
    expect(() => scoreLandSport("playa", CLEAR_DAY)).toThrow('deporte no soportado "playa"');
  });

  it("enruta cada deporte de agua a su función correspondiente", () => {
    expect(scoreWaterSport("playa", BEACH_DAY, FLAT_SEA)).toBe(scorePlaya(BEACH_DAY, FLAT_SEA));
    expect(scoreWaterSport("surf", BEACH_DAY, GOOD_SURF_SEA)).toBe(scoreSurf(BEACH_DAY, GOOD_SURF_SEA));
    expect(scoreWaterSport("windsurf", BEACH_DAY, FLAT_SEA)).toBe(scoreWindsurf(BEACH_DAY, FLAT_SEA));
  });

  it("lanza un error legible si se le pasa un deporte de tierra", () => {
    expect(() => scoreWaterSport("running", CLEAR_DAY, FLAT_SEA)).toThrow('deporte no soportado "running"');
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
