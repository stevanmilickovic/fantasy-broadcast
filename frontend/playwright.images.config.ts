import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testMatch: 'league-images.spec.ts',
  use: { ...base.use, launchOptions: {} },
  projects: [
    {
      name: 'firefox-images',
      use: { browserName: 'firefox', viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'webkit-images',
      use: {
        browserName: 'webkit',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
