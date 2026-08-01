# XRSPS

A community-driven project inspired by Project Zanaris.
OSRS in the browser with a React/WebGL client and TypeScript WebSocket server.

## Packages

This repository root contains only:

- [`client/`](client/) — `@xrsps/client` (browser app)
- [`server/`](server/) — `@xrsps/server` (game server)
- [`docs/`](docs/) — documentation site

## Quick Start

Requires **Node.js v22.16+** and **Yarn**.

```bash
# Server
cd server
yarn install
yarn build-collision
yarn start

# Client (separate terminal)
cd client
yarn install
yarn start

# Docs (optional)
cd docs
yarn install
yarn dev
```

See [docs/setup.md](docs/setup.md) for details.

---

Fan project. Not affiliated with, endorsed by, or connected to Jagex Ltd.
Old School RuneScape and related assets/trademarks belong to their respective owners.
