Pipeline Agent
================

This script implements a simple four-stage pipeline used for demos and CI checks.

- Artifacts directory: `pipeline_artifacts/` (auto-created under this folder)
- Commands: `node pipeline_agent.js run|plan|code|debug|review|test`

Security note: artifacts are intended for local/CI use and are gitignored by default.
