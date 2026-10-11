# HMI panel

Runs draw.io HMI/SCADA screens in Grafana dashboards. Screens are draw.io diagrams with InTouch-style animation links (value displays, fills, colours, blinking, sliders, pushbuttons, scripts, triggers and more), drawn with the draw.io editor and driven by your Grafana queries.

## Features

- **Runs in the dashboard.** The lightweight draw.io HMI runtime renders the screen directly in the panel, without an iframe. All HMI panels of a dashboard share one copy of the runtime.
- **Grafana data as tags.** Each field of the query results becomes a tag, named after its display name (set an alias to name it). Its last value drives the screen. A tag mapping option renames fields.
- **Dashboard variables.** `${variable}` in the screen is replaced, so one screen serves every device.
- **Edit in Grafana.** In panel edit, **Edit diagram** opens the full draw.io editor with the HMI plugin. Changes are saved to the panel as you edit; the editor's tag pickers list the query fields.
- **Writes.** Pushbuttons and inputs on tags of a "host" data source post `{tag, value, dashboardUid, panelId}` to a URL you choose, for users with at least the role you choose. Off by default.
- **Roles.** The Grafana org role (viewer, editor, admin) drives the HMI Security links.

## Requirements

- Grafana 12.1 or later.
- The **HMI Editor** app plugin (`softalink-hmieditor-app`) to edit screens.
- For the editor overlay, Grafana must allow framing (`[security] allow_embedding = true`). Otherwise the panel opens the editor in a separate window.

## Getting started

1. Add a panel and choose the **HMI** visualization.
2. In the panel options, click **Load demo** to try the InTouch demo screen, or **Edit diagram** to draw your own.
3. Give your queries aliases that match the tag names of the screen, or use **Tag mapping**.
4. Save the dashboard.
