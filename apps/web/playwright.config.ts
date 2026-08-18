import { defineConfig, devices } from "@playwright/test";

const PORT = 4300;

// El navegador ya viene instalado en la imagen (PLAYWRIGHT_BROWSERS_PATH), por eso
// no se ejecuta `playwright install` en ninguna parte.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Se prueba contra el build de producción, no contra `next dev`: es lo que se
  // despliega en Vercel y lo único que reproduce el orden de capas real.
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
