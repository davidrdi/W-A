import { expect, test, type Page } from "@playwright/test";

import { decodePng, shareOfColor } from "./png";

/**
 * Color de los tiles falsos. Es un magenta que no aparece en ninguna parte de la UI,
 * así que encontrarlo en una captura solo puede significar una cosa: el mapa se está
 * pintando ahí.
 */
const TILE_RGB: [number, number, number] = [224, 16, 192];

// PNG 8x8, colorType 2 (RGB sin canal alfa) => totalmente opaco. Que sea opaco es
// justo lo que hace que el mapa tape lo que tenga debajo.
const OPAQUE_TILE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGN4IHAAK2IYWhIAOz5sAef02oEAAAAASUVORK5CYII=",
  "base64",
);

/**
 * Sirve los tiles del mapa desde el propio test.
 *
 * Es la pieza imprescindible de esta suite: `leaflet.css` deja los tiles en
 * `visibility: hidden` y solo los muestra cuando cargan de verdad
 * (`.leaflet-tile-loaded { visibility: inherit }`). En un entorno sin salida al CDN
 * de tiles nunca llegan a hacerse visibles, así que no pintan nada y CUALQUIER bug
 * de superposición del mapa sobre la UI queda invisible. Fue exactamente ese punto
 * ciego el que dejó pasar en producción el bug que cubren estos tests.
 */
async function stubMapTiles(page: Page) {
  // Regex y no glob: la capa usa subdominios ({s} -> a/b/c/d.basemaps.cartocdn.com),
  // que un patrón tipo "**/basemaps.cartocdn.com/**" no llega a casar.
  await page.route(/basemaps\.cartocdn\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: OPAQUE_TILE_PNG }),
  );
}

async function openMapTab(page: Page) {
  await stubMapTiles(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  // Sin tiles cargados el test no prueba nada, así que se exige su presencia.
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
}

/** Fracción de la caja de un elemento que aparece cubierta por el mapa. */
async function mapCoverage(page: Page, selector: ReturnType<Page["getByRole"]>) {
  const shot = await selector.screenshot();
  return shareOfColor(decodePng(shot), TILE_RGB);
}

test.describe("pestaña Mapa: la UI se mantiene por encima del mapa", () => {
  test("el mapa no se pinta por encima del panel de búsqueda", async ({ page }) => {
    await openMapTab(page);

    // Se comprueba por píxeles y no con elementFromPoint a propósito: los tiles de
    // Leaflet no capturan el puntero, así que el hit-testing pasa "a través" de ellos
    // y da un falso verde aunque visualmente tapen el panel por completo.
    const playaPill = page.getByRole("button", { name: "Playa", exact: true });
    await expect(playaPill).toBeVisible();
    expect(await mapCoverage(page, playaPill)).toBeLessThan(0.02);

    const searchButton = page.getByRole("button", { name: /Buscar zonas de/i });
    expect(await mapCoverage(page, searchButton)).toBeLessThan(0.02);
  });

  test("las pills de deporte siguen siendo seleccionables sobre el mapa", async ({ page }) => {
    await openMapTab(page);

    const playaPill = page.getByRole("button", { name: "Playa", exact: true });
    await playaPill.click({ timeout: 5000 });

    await expect(playaPill).toHaveClass(/bg-primary\/90/);
    await expect(page.getByRole("button", { name: /Buscar zonas de playa/i })).toBeVisible();
  });

  test("el campo de localidad queda visible y usable sobre el mapa", async ({ page }) => {
    await openMapTab(page);

    const localityInput = page.getByPlaceholder("Localidad (ej. A Coruña)");
    await localityInput.fill("Vigo");
    await expect(localityInput).toHaveValue("Vigo");
    expect(await mapCoverage(page, localityInput)).toBeLessThan(0.02);
  });

  test("Leaflet queda encerrado en su propio stacking context", async ({ page }) => {
    await openMapTab(page);

    // Comprobación de la causa raíz: si `.leaflet-container` no crea stacking context,
    // sus paneles (z-index 400-1000) escapan al contexto raíz y ganan a toda la UI.
    const createsStackingContext = await page.evaluate(() => {
      const container = document.querySelector(".leaflet-container");
      if (!container) return null;
      const style = getComputedStyle(container);
      return style.isolation === "isolate" || style.zIndex !== "auto";
    });

    expect(createsStackingContext).toBe(true);
  });
});
