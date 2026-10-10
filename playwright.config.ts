import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4187/runKLMrun/', browserName: 'chromium' },
  workers: 1,
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4187 --strictPort', url: 'http://127.0.0.1:4187/runKLMrun/', reuseExistingServer: false },
});
