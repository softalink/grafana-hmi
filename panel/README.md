# HMI panel (softalink-hmi-panel)

The Grafana panel plugin of this repository. See the [repository README](../README.md) for building, running and testing; `src/README.md` is the plugin's catalog page.

```sh
npm install
npm run dev         # webpack watch; then run the root `npm run copy-drawio` once
npm run typecheck && npm run lint && npm run test:ci
npm run e2e         # Playwright against the Grafana from the root docker-compose.yaml
```
