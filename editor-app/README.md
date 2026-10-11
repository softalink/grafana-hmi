# HMI Editor

Serves the draw.io editor with the HMI plugin for the **HMI** panel (`softalink-hmi-panel`). It has no pages of its own: in panel edit, **Edit diagram** opens the editor from this plugin in an overlay (iframe) or a separate window, and the editor sends the diagram back to the panel as you edit.

The editor files are served by Grafana from `/public/plugins/softalink-hmieditor-app/editor/`. For the overlay, Grafana must allow framing (`[security] allow_embedding = true`); otherwise the panel uses a window.
