import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  use: {
    baseURL: 'http://localhost:8081',
  },
  webServer: {
    command: 'npx expo start --web',
    port: 8081,
    reuseExistingServer: true,
  },
});
