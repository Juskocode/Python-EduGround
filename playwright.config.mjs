import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 14_373);
const externalBaseUrl = process.env.E2E_BASE_URL?.trim();
const baseURL = externalBaseUrl || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 7_500,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL,
    colorScheme: "dark",
    locale: "en-GB",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `node scripts/serve.mjs --host 127.0.0.1 --port ${port}`,
        url: `${baseURL}/healthz`,
        reuseExistingServer: false,
        timeout: 15_000,
        env: {
          APP_ORIGIN: baseURL,
          DATABASE_URL: "",
          NODE_ENV: "test",
        },
      },
});
