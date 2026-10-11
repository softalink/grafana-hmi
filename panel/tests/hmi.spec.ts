import { expect, test } from '@grafana/plugin-e2e';
import type { Frame, Page } from '@playwright/test';

// The provisioned dashboard (scripts/make-dashboard.mjs): panel 1 shows a
// tank fed by TestData (Level = 42.5, Pump = 1), panel 2 the InTouch demo.
const DASHBOARD = { uid: 'hmi-demo' };
const TANK = 'Tank (TestData)';
const DEMO = 'InTouch demo (simulated)';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  return errors;
}

function instances(page: Page) {
  return page.evaluate(() => (window as any).Hmi?.Viewer?.instances?.length ?? 0);
}

// Grafana sends X-Frame-Options: deny unless allow_embedding is on; the
// panel then opens the editor in a window. HMI_EDITOR_MODE says which one
// the server under test allows (docker-compose.yaml turns embedding on).
const EDITOR_MODE = process.env.HMI_EDITOR_MODE === 'window' ? 'window' : 'overlay';

async function waitForEditor(frame: Frame) {
  await frame.waitForFunction(
    () => {
      const w = window as any;

      return w.Hmi?.ui?.hmiHostTags != null && w.Hmi.ui.editor.graph.model.getCell('tank') != null;
    },
    null,
    { timeout: 90000 }
  );

  return frame;
}

/** Clicks Edit diagram and returns the editor's frame (in the overlay or a window). */
async function openEditor(page: Page): Promise<Frame> {
  if (EDITOR_MODE === 'window') {
    const popup = page.waitForEvent('popup');
    await page.getByTestId('hmi-edit-diagram').click();
    const win = await popup;
    await expect(page.getByTestId('hmi-editor-window')).toBeVisible();

    return waitForEditor(win.mainFrame());
  }

  await page.getByTestId('hmi-edit-diagram').click();
  await expect(page.getByTestId('hmi-editor-frame')).toBeVisible();
  let frame: Frame | undefined;
  await expect
    .poll(() => {
      frame = page.frames().find((f) => f.url().includes('/softalink-hmieditor-app/editor/index.html'));

      return frame != null;
    })
    .toBe(true);

  return waitForEditor(frame!);
}

test('runtime: the tank screen shows Grafana data and dashboard variables', async ({ gotoDashboardPage, page }) => {
  const errors = trackErrors(page);
  const dashboard = await gotoDashboardPage(DASHBOARD);
  const tank = dashboard.getPanelByTitle(TANK).locator;

  await expect(tank).toContainText('Level = 42.5 %');
  await expect(tank).toContainText('Site: Plant-1');
  await expect(tank).toContainText('SP = 50');
  await expect.poll(() => instances(page)).toBe(2);

  // The Pump query's last value (1) turns the pump green
  const pumpFill = await page.evaluate(() => {
    const api = (window as any).Hmi.Viewer.instances.find((a: any) => a.getValue('Pump') !== undefined);
    const graph = api.ui.editor.graph;

    return graph.view.getState(graph.model.getCell('pump')).style.fillColor;
  });
  expect(String(pumpFill).toUpperCase()).toBe('#43A047');
  expect(errors).toEqual([]);
});

test('runtime: the demo template runs with its simulation', async ({ gotoDashboardPage, page }) => {
  const errors = trackErrors(page);
  const dashboard = await gotoDashboardPage(DASHBOARD);
  const demo = dashboard.getPanelByTitle(DEMO).locator;

  await expect(demo).toContainText('InTouch animation links: display links');
  // Simulated values change the level label
  const label = () =>
    page.evaluate(() => {
      const api = (window as any).Hmi.Viewer.instances.find((a: any) => a.getValue('Mode') !== undefined);

      return api == null ? null : api.getValue('Level');
    });
  const first = await label();
  await expect.poll(label, { timeout: 10000 }).not.toBe(first);
  expect(errors).toEqual([]);
});

test('runtime: a variable change remounts the screen', async ({ gotoDashboardPage, page }) => {
  const dashboard = await gotoDashboardPage({ ...DASHBOARD, queryParams: new URLSearchParams({ 'var-site': 'Plant-2' }) });
  await expect(dashboard.getPanelByTitle(TANK).locator).toContainText('Site: Plant-2');
});

test('runtime: writes go to the write URL for editors', async ({ gotoDashboardPage, page }) => {
  const errors = trackErrors(page);
  const writes: Array<{ url: string; body: any }> = [];
  await page.route('**/api/hmi-test/write**', async (route) => {
    writes.push({ url: route.request().url(), body: route.request().postDataJSON() });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  const dashboard = await gotoDashboardPage(DASHBOARD);
  const tank = dashboard.getPanelByTitle(TANK).locator;
  await expect(tank).toContainText('SP = 50');

  await tank.getByText('SP + 5').click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].url).toContain('site=Plant-1');
  expect(writes[0].body).toMatchObject({ tag: 'SetPoint', value: 55, dashboardUid: 'hmi-demo', panelId: 1 });
  await expect(tank).toContainText('SP = 55');
  expect(errors).toEqual([]);
});

test('runtime: a remount replaces the viewer instead of adding one', async ({ gotoDashboardPage, page }) => {
  const errors = trackErrors(page);
  const dashboard = await gotoDashboardPage(DASHBOARD);
  const tank = dashboard.getPanelByTitle(TANK).locator;
  await expect(tank).toContainText('Site: Plant-1');
  await expect.poll(() => instances(page)).toBe(2);

  // A variable change in the page (no reload) remounts the tank screen
  // The picker's input sits next to its value (Grafana 12 and 13)
  await page.getByText('Plant-1', { exact: true }).first().locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: 'Plant-2' }).click();
  await expect(tank).toContainText('Site: Plant-2');
  await expect(tank).toContainText('Level = 42.5 %');
  await expect.poll(() => instances(page)).toBe(2);
  expect(errors).toEqual([]);
});

test('edit: the editor opens in an iframe, gets the Grafana tags and autosaves', async ({
  gotoPanelEditPage,
  page,
}) => {
  const errors = trackErrors(page);
  const editPage = await gotoPanelEditPage({ dashboard: DASHBOARD, id: '1' });
  await expect(page.getByTestId('hmi-diagram-summary')).toHaveText('1 page, 5 objects with links');

  // Messages the editor sends back (an unknown message would be an error)
  await page.evaluate(() => {
    const w = window as any;
    w.hmiEditorMessages = [];
    window.addEventListener('message', (evt) => {
      try {
        w.hmiEditorMessages.push(JSON.parse(evt.data));
      } catch (e) {
        // not ours
      }
    });
  });

  const frame = await openEditor(page);

  // The tag pickers offer the query fields
  const known: string[] = await frame.evaluate(() => (window as any).Hmi.Editors.getKnownTags((window as any).Hmi.ui));
  expect(known).toEqual(expect.arrayContaining(['Level', 'Pump', 'SetPoint']));

  // Esc in the editor stays in the editor: panel edit stays open
  await frame.locator('body').press('Escape');
  await expect(page.getByTestId(EDITOR_MODE === 'window' ? 'hmi-editor-window' : 'hmi-editor-overlay')).toBeVisible();
  expect(page.url()).toContain('editPanel');

  // A change is autosaved into the panel option and the preview
  await frame.evaluate(() => {
    const graph = (window as any).Hmi.ui.editor.graph;
    graph.insertVertex(graph.getDefaultParent(), 'added', 'Added in the editor', 40, 270, 200, 24, 'text;html=1;');
  });
  await expect(editPage.panel.locator).toContainText('Added in the editor');

  await page.getByRole('button', { name: 'Close editor' }).click();
  await expect(page.getByTestId('hmi-editor-overlay')).toHaveCount(0);
  await expect(page.getByTestId('hmi-editor-window')).toHaveCount(0);
  await expect(page.getByTestId('hmi-diagram-summary')).toHaveText('1 page, 5 objects with links');
  expect(
    await page.evaluate(() => (window as any).hmiEditorMessages.filter((m: any) => m.error != null))
  ).toEqual([]);
  expect(await page.evaluate(() => (window as any).hmiEditorMessages.some((m: any) => m.event === 'hmiReady'))).toBe(
    true
  );
  expect(errors).toEqual([]);
});

test('edit: Exit in the editor ends the session', async ({ gotoPanelEditPage, page }) => {
  await gotoPanelEditPage({ dashboard: DASHBOARD, id: '1' });
  const frame = await openEditor(page);
  await frame.evaluate(() => (window as any).Hmi.ui.actions.get('exit').funct());
  await expect(page.getByTestId('hmi-editor-overlay')).toHaveCount(0);
  await expect(page.getByTestId('hmi-editor-window')).toHaveCount(0);
});
