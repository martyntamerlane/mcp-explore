# Deployments

Every release to GitHub Pages gets a row (deploys happen automatically on push to main via `.github/workflows/deploy.yml`). Keep entries terse.

| Date | What shipped | Status | Note |
|------|--------------|--------|------|
| 2026-08-25 | Initial release: scaffold, demo MCP server, connection layer, proof-harness UI (PR #1) | ok | First Pages deploy; run 32801612974, ~30s |
| 2026-08-25 | UI v1: flow view, detail panel, dune mode (PR #2) | ok | Run 32856035432, ~1m2s; row backfilled 2026-08-29 |
| 2026-08-29 | Luminous deck + tool-first workspace: one chrome band, browse column, permanent workspace, one-click run, schema-driven input forms, dark mode (PR #3) | ok | Run 33262179259, ~49s; verified live bundle serves the new UI |
| 2026-08-29 | Visual system tightening (type/space scale, single-column results, landing priority) + markdown detection and rendering (PR #4) | ok | Run 33267649751, ~51s; verified live: scale tokens present, prism on the Connect door, a text/markdown resource renders with its raw toggle, no console errors |
