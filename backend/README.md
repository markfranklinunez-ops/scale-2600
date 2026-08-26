# FPL Draft Assistant backend

This directory contains the first backend scaffold for the Draft Assistant.

## API

- `GET /health` returns service status.
- `POST /rank` accepts normalized player data and returns rating + expected-points estimates.

The ranking weights are intentionally provisional. The next step is to add data-source adapters and validate the model against historical gameweeks before using it for recommendations.

## Deployment target

Cloudflare Workers is the intended first deployment target. The Worker can be deployed separately from the GitHub Pages frontend; no secrets belong in the frontend repository.
