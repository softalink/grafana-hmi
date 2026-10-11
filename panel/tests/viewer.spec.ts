import { expect, test } from '@grafana/plugin-e2e';

// A Viewer cannot write: the panel refuses before anything is sent
test.use({
  storageState: { cookies: [], origins: [] },
  user: { user: 'hmi-viewer', password: 'hmi-viewer-pass', role: 'Viewer' },
});

test('runtime: viewers cannot write', async ({ createUser, gotoDashboardPage, page }) => {
  await createUser();
  await page.goto('/login');
  await page.getByPlaceholder(/email or username/i).fill('hmi-viewer');
  await page.getByPlaceholder(/password/i).fill('hmi-viewer-pass');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
  const writes: string[] = [];
  await page.route('**/api/hmi-test/write**', async (route) => {
    writes.push(route.request().url());
    await route.fulfill({ status: 200, body: '{}' });
  });
  const dashboard = await gotoDashboardPage({ uid: 'hmi-demo' });
  const tank = dashboard.getPanelByTitle('Tank (TestData)').locator;
  await expect(tank).toContainText('SP = 50');
  await tank.getByText('SP + 5').click();
  await expect(page.getByText('Your role cannot write SetPoint')).toBeVisible();
  expect(writes).toEqual([]);
});
