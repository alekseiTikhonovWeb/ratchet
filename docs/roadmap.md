# Roadmap (not for the hackathon build)

Anything that is not on the golden path goes here. Do not build it before submission.

- Class components → hooks (same engine: graph, batch, ratchet on `class extends React.Component` count)
- Create React App → Vite (ratchet on `react-scripts` references + build time)
- Coverage push: graph of untested modules by call depth, coverage ratchet
- Path aliases / `baseUrl` / monorepo workspaces in `build_graph`
- Dashboard: hover on file → imports/importedBy; D3 force layout for cross-layer edges
- Granite (watsonx.ai) natural-language summary in `report.html`
- Native Bob Workflow once workflow authoring is open
- Per-batch git commit from `record_step` (opt-in)
