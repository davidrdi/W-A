import { expect, test, type Page } from "@playwright/test";

const OPAQUE_TILE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGN4IHAAK2IYWhIAOz5sAef02oEAAAAASUVORK5CYII=",
  "base64",
);

async function openMapTab(page: Page) {
  await page.route(/basemaps\.cartocdn\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: OPAQUE_TILE_PNG }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
}

// Si una búsqueda vuelve vacía o falla, la app TIENE que decirlo. Sin esto el
// usuario ve el mismo mapa sin pines en los dos casos y no puede distinguir
// "aquí no hay zonas" de "algo se ha roto".
test.describe("pestaña Mapa: la búsqueda siempre cuenta cómo ha ido", () => {
  test("dice explícitamente que no hay zonas cuando el backend devuelve lista vacía", async ({ page }) => {
    await openMapTab(page);
    await page.route(/\/spots\?/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          locality: "A Coruña, Galicia, España",
          sport: "running",
          source: "osm",
          localityCenter: { lat: 43.3623, lon: -8.4115 },
          spots: [],
        }),
      }),
    );

    await page.getByRole("button", { name: /Buscar zonas de running/i }).click();

    await expect(page.getByText(/No se encontraron zonas/i)).toBeVisible();
  });

  test("enseña el motivo real cuando el backend falla, no un error genérico", async ({ page }) => {
    await openMapTab(page);
    await page.route(/\/spots\?/, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        // Forma real de un error de Fastify: el detalle va en `message`.
        body: JSON.stringify({ statusCode: 500, error: "Internal Server Error", message: "Overpass respondió 406" }),
      }),
    );

    await page.getByRole("button", { name: /Buscar zonas de running/i }).click();

    await expect(page.getByText("Overpass respondió 406")).toBeVisible();
  });

  test("resume cuántas zonas ha encontrado y dónde", async ({ page }) => {
    await openMapTab(page);
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
            { id: "way/1", name: "Parque", lat: 43.35, lon: -8.4, sport: "running", score: 80, scoreBand: "green" },
            { id: "way/2", name: "Paseo", lat: 43.37, lon: -8.41, sport: "running", score: 50, scoreBand: "amber" },
          ],
        }),
      }),
    );

    await page.getByRole("button", { name: /Buscar zonas de running/i }).click();

    await expect(page.getByText(/2 zonas/i)).toBeVisible();
    await expect(page.getByText(/A Coruña/)).toBeVisible();
  });
});
