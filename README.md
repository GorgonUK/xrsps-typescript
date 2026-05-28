# xrsps-typescript

xRSPS is intended to explore OSRS in a similar spirit to Jagex's abandoned Project Zanaris.

Latest cache supported: osrs-237_2026-03-25

Discord: https://discord.gg/3dzttF2q73

This project contains:

- a React/WebGL game client
- a TypeScript WebSocket game server
- cache-driven widgets, CS2/UI behaviour, map loading, models, audio, and gameplay systems

## Status

This is an active work-in-progress community project, not intended to be a finished game.

## Tech Stack

- TypeScript
- React
- WebGL / PicoGL
- WebSockets
- Cache-driven client and server tooling

## Project Structure

- `src`: browser client, rendering, widgets, cache loaders, gameplay client logic
- `server`: WebSocket server, world logic, pathfinding, widgets, scripts
- `scripts`: cache utilities and export tools

## Requirements

Ensure you have these or you might run into weird issues.

- Node.js v22.16+
- Yarn

## Getting Started

Install dependencies:

```bash
yarn install
```

Build the server collision cache:

```bash
yarn server:build-collision
```

Build the world map into static images:

```bash
yarn export-map-images
```

Start the server:

```bash
yarn server:start
```

Start the client in another terminal:

```bash
yarn start
```

By default the WebSocket server runs on:

- host: `0.0.0.0`
- port: `43594`

## Useful Scripts

```bash
yarn start
yarn server:start
yarn server:build-collision
yarn download-caches
yarn export-textures
yarn export-map-images
yarn mcp
```

## In-Game Commands

All commands are typed in the chat box prefixed with `::`. Admin-only commands require your username (case-insensitive) to be listed in the `ADMIN_USERNAMES` env var in `server/.env` (defaults to `lol,bot`).

> Note: `::bank`, `::wiki`, and `::toggleroof` are intercepted by the official OSRS CS2 script `chatdefault_onkey` (script 73) before they leave the client, so they can never reach the server. Avoid these names for new commands.

### General

| Command | Description |
| --- | --- |
| `::position` (`::pos`) | Print your `(x, y, z)`, region ID, and music region name |
| `::home` | Teleport to the Lumbridge respawn point |
| `::clear` | Empty your inventory |
| `::kill` | Set your HP to 0 |
| `::levelup` | Award a random skill +1 level (with the level-up popup) |
| `::vote` | Open the vote modal |

### Items & Gear

| Command | Description |
| --- | --- |
| `::item <itemId> [quantity]` | Spawn an item by ID |
| `::itemspawner [query]` | Open the item spawner modal, optionally pre-filtered |
| `::whip` | Get an Abyssal whip (4151) |
| `::bond` | Get a $5 Bond (50000) |
| `::allrunes [quantity]` | Replace inventory with every rune type (default 10,000 each) |
| `::randomitem` | Add a random unowned collection log item to your inventory |
| `::rubytest` | Spawn a ruby-enchant test pack (bolts + runes) and raise Magic to 49 if lower |

### Skills & Quests

| Command | Description |
| --- | --- |
| `::smithing <1-99>` | Set your Smithing level |
| `::quest list` | List available quests |
| `::quest <name>` | Mark a quest as completed (sets the relevant varp/varbits) |
| `::scroll` | Open a debug `menu_indexed` test menu |

### Admin Only

| Command | Description |
| --- | --- |
| `::tele <x> <y> [z]` | Teleport to coordinates |
| `::npc <npcTypeId>` | Spawn an NPC of that type at your tile |
| `::openbank` | Open your bank (renamed from `::bank` since the client intercepts it) |
| `::master` | Set every skill to 99 |
| `::maxmelee` | Spawn a max melee loadout (Torva, Fang, Avernic, Ferocious, Primordial, Berserker (i)) |
| `::maxranged` | Spawn a max ranged loadout (Masori, Tbow, Zaryte vambs, Pegasian, Archers (i)) + 10,000 dragon arrows |
| `::maxmagic` | Spawn a max magic loadout (Ancestral, Shadow, Occult, Tormented, Eternal, Seers (i), Elidinis' ward) |

## Design Goals

- OSRS parity first
- shared systems over one-off feature hacks
- cache and CS2 driven UI behaviour
- browser-first gameplay with desktop and mobile support

## Notes

- This repository is under active development and internal tooling/debug paths may change frequently.
- Some systems are intentionally unfinished while parity work is still ongoing.
- Cache assets are not embedded in the repo and must be downloaded locally.
- Feel free to use your own AI tooling to submit any new features or contributions
- UI is entirely CS2 driven on the client side, typically trigger by serverside scripts

## Disclaimer

This is a fan project and is not affiliated with, endorsed by, or connected to Jagex Ltd.  
Old School RuneScape and related assets/trademarks belong to their respective owners.
