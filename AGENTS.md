# AGENTS.md

## Cursor Cloud specific instructions

xRSPS is a full-stack OSRS emulator: a React/WebGL browser **client** (`src/`, CRA + craco) and a
TypeScript WebSocket **game server** (`server/`). See `README.md`, `docs/setup.md`, and
`docs/ARCHITECTURE.md` for the canonical overview and command list.

### Node version (important)
- Use **Node 22.22.2** via nvm: `nvm use 22.22.2`. The VM's default `node` on `PATH`
  (`/exec-daemon/node`) is 22.14.0, which is **too old** — `lint-staged` requires `node >=22.22.1`, so
  `yarn install` aborts under the default node. The startup update script already runs `yarn install`
  under 22.22.2; run the `nvm use` line yourself in any new shell before invoking `yarn`/`tsx`.
- Package manager is **Yarn v1** (matches `yarn.lock`, `vercel.json`, README). A stray
  `package-lock.json` also exists — ignore it; do not use npm.

### One-time data prerequisites (gitignored; not in git, live only on the VM/snapshot)
- **OSRS cache** (`caches/`): auto-downloaded from the OpenRS2 archive (~25s) by `yarn ensure-cache`,
  which also runs automatically at the start of `yarn start` and `yarn server:start`. Requires network.
- **Collision cache** (`server/cache/collision/`): built by `yarn server:build-collision`. This is a
  **one-time, slow (~5-6 min)** step and is **not** auto-built. The server boots with
  `precomputed=true` and needs this present. If the server fails to boot referencing collision data,
  rebuild it with `yarn server:build-collision`.

### Running the app (two separate processes)
- Server: `yarn server:start` → WebSocket on `ws://0.0.0.0:43594`.
- Client: `BROWSER=none yarn start` → dev server on `http://localhost:3000` (use `BROWSER=none` so CRA
  does not try to launch a browser). The client defaults to `ws://localhost:43594`
  (`src/config/clientEnv.ts`), so no env config is needed for local play.
- Gamemode is read from `server/config.json` (currently `leagues-v`, displayed as "Raging Echoes");
  override with the `GAMEMODE` env var.
- Login: any username + password of 8-20 chars; the first successful login registers that account.
- `.env` sets `FAST_REFRESH=false`, so CRA fast-refresh is disabled (edits require a manual reload).

### Lint / test
- Lint: `yarn lint` = `prettier --write "./**/*.{js,ts,jsx,tsx,css,md}"` — it **rewrites files**. The
  repo is not fully prettier-clean (~69 files), so don't run `--write` unless you intend to commit
  formatting; use `npx prettier --check ...` to inspect. There is no ESLint CLI script.
- Tests: there is **no `test` npm script**. The suites in `tests/` are standalone `tsx` scripts; run
  each individually, e.g. `npx tsx tests/authentication.test.ts`. All eight pass.
