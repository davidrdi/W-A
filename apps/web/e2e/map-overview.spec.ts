import { expect, test, type Page } from "@playwright/test";

const OPAQUE_TILE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGN4IHAAK2IYWhIAOz5sAef02oEAAAAASUVORK5CYII=",
  "base64",
);

const OVERVIEW_RUNNING = {
  sport: "running",
  spots: [
    { id: "seed/parque-a", name: "Parque A", locality: "A Coruña, Galicia, España", lat: 43.36, lon: -8.41, sport: "running", score: 82, scoreBand: "green" },
    { id: "seed/parque-b", name: "Parque B", locality: "Madrid, Comunidad de Madrid, España", lat: 40.42, lon: -3.68, sport: "running", score: 55, scoreBand: "amber" },
  ],
};

const OVERVIEW_PLAYA = {
  sport: "playa",
  spots: [
    { id: "seed/playa-a", name: "Playa A", locality: "Vigo, Galicia, España", lat: 42.2, lon: -8.7, sport: "playa", score: 30, scoreBand: "red" },
  ],
};

async function stub(page: Page) {
  await page.route(/basemaps\.cartocdn\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: OPAQUE_TILE_PNG }),
  );
  await page.route(/\/overview\?sport=running/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(OVERVIEW_RUNNING) }),
  );
  await page.route(/\/overview\?sport=playa/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(OVERVIEW_PLAYA) }),
  );
}

test.describe("pestaña Mapa: vista general sin buscar", () => {
  test("al entrar en Mapa ya hay pines, sin pulsar Buscar", async ({ page }) => {
    await stub(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Mapa", exact: true }).click();
    await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();

    // Nunca se pulsa "Buscar zonas de running" en este test.
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(OVERVIEW_RUNNING.spots.length);
    await expect(page.getByText(/Vista general/i)).toBeVisible();
  });

  test("cambiar de deporte actualiza la vista general sin pulsar Buscar", async ({ page }) => {
    await stub(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Mapa", exact: true }).click();
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(OVERVIEW_RUNNING.spots.length);

    await page.getByRole("button", { name: "Playa", exact: true }).click();

    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(OVERVIEW_PLAYA.spots.length);
  });

  test("buscar una localidad concreta reemplaza la vista general, y se puede volver", async ({ page }) => {
    await stub(page);
    await page.route(/\/spots\?/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          locality: "A Coruña, Galicia, España",
          sport: "running",
          source: "osm",
          localityCenter: { lat: 43.3623, lon: -8.4115 },
          spots: [
            { id: "way/1", name: "Parque real", lat: 43.36, lon: -8.41, sport: "running", score: 90, scoreBand: "green" },
          ],
        }),
      }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Mapa", exact: true }).click();
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(OVERVIEW_RUNNING.spots.length);

    await page.getByRole("button", { name: /Buscar zonas de running/i }).click();
    // "Parque real" solo se ve en el popup del marcador, que no se abre solo;
    // el título del marcador (atributo `title` de Leaflet) sí es un hook fiable.
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(1);
    await expect(page.locator('.leaflet-marker-icon[title="Parque real"]')).toBeVisible();

    await page.getByText(/Ver todo el país/i).click();
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(OVERVIEW_RUNNING.spots.length);
  });
});
