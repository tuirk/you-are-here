import { defineConfig, devices } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:5174";

export default defineConfig({
  testDir: "./e2e",
  // WebGL contexts are the constraint here, not CPU. Running specs in
  // parallel under software rendering makes later contexts fail to
  // initialise and produces blank frames, so this suite stays serial.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  // Bloom and multisampling make each frame expensive under SwiftShader —
  // a full-page screenshot of the composed scene can take ~30s on a runner
  // without a GPU. Real hardware is far quicker; this budget is for CI.
  timeout: 150_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          // Force a software GL stack so the scene renders identically on
          // machines and CI runners without a real GPU.
          args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
