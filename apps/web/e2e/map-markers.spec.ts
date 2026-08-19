import { expect, test, type Page } from "@playwright/test";

const OPAQUE_TILE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGN4IHAAK2IYWhIAOz5sAef02oEAAAAASUVORK5CYII=",
  "base64",
);

// Respuesta de /spots con la forma real de SpotsResponse. Se stubea el backend
// para poder probar el pintado de pines sin depender de Overpass/Open-Meteo,
// que además están bloqueados en CI.
const SPOTS_RESPONSE = {
  locality: "A Coruña, Galicia, España",
  sport: "running",
  source: "osm",
  localityCenter: { lat: 43.3623, lon: -8.4115 },
  spots: [
    {
      id: "way/1",
      name: "Parque de Santa Margarita",
      lat: 43.3585,
      lon: -8.4085,
      sport: "running",
      score: 82,
      scoreBand: "green",
    },
    {
      id: "way/2",
      name: "Paseo Marítimo",
      lat: 43.3712,
      lon: -8.4189,
      sport: "running",
      score: 55,
      scoreBand: "amber",
    },
    {
      id: "way/3",
      name: "Monte de San Pedro",
      lat: 43.3668,
      lon: -8.4353,
      sport: "running",
      score: 31,
      scoreBand: "red",
    },
  ],
};

async function setup(page: Page) {
  await page.route(/basemaps\.cartocdn\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: OPAQUE_TILE_PNG }),
  );
  await page.route(/\/spots\?/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SPOTS_RESPONSE) }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
}

test.describe("pestaña Mapa: pines de las zonas encontradas", () => {
  test("pinta un pin por cada zona devuelta por el backend", async ({ page }) => {
    await setup(page);

    await page.getByRole("button", { name: /Buscar zonas de running/i }).click();

    const markers = page.locator(".leaflet-marker-icon");
    await expect(markers).toHaveCount(SPOTS_RESPONSE.spots.length);
    await expect(markers.first()).toBeVisible();
  });

  test("cada pin usa el color de su banda de score", async ({ page }) => {
    await setup(page);
    await page.getByRole("button", { name: /Buscar zonas de running/i }).click();
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(3);

    const colors = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".leaflet-marker-icon div div")).map(
        (el) => (el as HTMLElement).style.background,
      ),
    );

    // verde / ámbar / rojo de SCORE_BAND_COLOR en @w-a/shared.
    expect(colors.join(" ")).toContain("rgb(22, 163, 74)");
    expect(colors.join(" ")).toContain("rgb(245, 158, 11)");
    expect(colors.join(" ")).toContain("rgb(220, 38, 38)");
  });

  test("al pulsar un pin se abre el panel de detalle de esa zona", async ({ page }) => {
    await setup(page);
    await page.route(/\/explain$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          score: 82,
          scoreBand: "green",
          headline: "Buen día para correr",
          reasoning: "Sin lluvia ayer y viento flojo.",
          cautions: [],
          groundingPayload: {
            sport: "running",
            spotName: "Parque de Santa Margarita",
            score: 82,
            scoreBand: "green",
            weather: {
              rainYesterdayMm: 0,
              rainTodayMm: 0,
              windAvgTodayKmh: 5,
              windMaxTodayKmh: 8,
              windDirectionMiddayDeg: 90,
              temperatureAvgTodayC: 18,
            },
          },
        }),
      }),
    );

    await page.getByRole("button", { name: /Buscar zonas de running/i }).click();
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(3);

    await page.locator(".leaflet-marker-icon").first().click();

    await expect(page.getByRole("heading", { name: /Parque de Santa Margarita|Paseo Marítimo|Monte de San Pedro/ })).toBeVisible();
  });
});
