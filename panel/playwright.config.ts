import type { PluginOptions } from '@grafana/plugin-e2e';
import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import baseConfig from './.config/playwright.config';

// A preinstalled Chromium (CHROMIUM_PATH) when Playwright's own is not installed
const chromium = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

export default defineConfig<PluginOptions>(baseConfig, {
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    viewport: { width: 1600, height: 1000 },
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
  },
});
