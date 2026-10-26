<img width="1920" height="1440" alt="showcase" src="https://github.com/user-attachments/assets/c2bcb683-1e29-43a2-b605-89aa468aa73a" />

# Jimu

A self-hosted, local-first workout log for the gym. Fast to type into, works offline, and syncs
between your devices.

## Features

- Text-based logging: one line per exercise and training day, with a set keypad on phones
- Warm-up, drop, bodyweight (weighted and assisted) and per-side sets
- Routines and splits: rotations every few days or on set gym days, or a fixed routine per
  weekday, with a rule for missed days
- Home dashboard with what's due today, the week ahead, stats and a calendar of the year
- Session history and progress charts per exercise (volume, top weight, estimated 1RM, reps)
- Works offline and installs as an app (PWA); devices sync automatically and changes made on two
  devices at once are merged, not overwritten
- Connector for Claude and ChatGPT (MCP): read your training and, if you allow it, log sets and
  create or change exercises, routines and splits, never delete
- Several accounts, with an admin overview
- kg or lb, your own letters for warm-up and drop sets, night, dark and light themes
- One Docker container with an SQLite database

## Usage

Write one line per exercise and training day, like `24.10. a10x12 30x10 x8 x7 d15x7`:

| Written | Means |
|---|---|
| `24.10.` | The day (a year can be added: `24.10.26`) |
| `30x10` | A working set: 30 kg × 10 reps |
| `x8` | Same weight as the set before, 8 reps |
| `a10x12` | Warm-up set (not counted in volume) |
| `d15x7` | Drop set |
| `x20` (no weight at all) | Bodyweight |
| `+10x8` | Bodyweight plus 10 added (a dip belt); only the added weight counts in volume |
| `-20x8` | Bodyweight with 20 of assistance (machine pull-ups); counts 0 in volume |
| `20x12/11` | One side at a time: 12 reps on the side you start with, 11 on the other |

Group exercises into routines and put routines on a schedule with splits (Routines → New). Train
with a routine selected so the day counts for it. Unit (kg or lb) and the warm-up and drop letters
are in Settings.

## Deployment

### Docker Compose (recommended)

```yaml
services:
  jimu:
    image: ghcr.io/0ql/jimu:latest
    container_name: jimu
    ports:
      - 3000:3000
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=/app/data/sqlite.db
      # Behind an HTTPS reverse proxy or tunnel: take the protocol (and, if it changes, the
      # host) from its headers, otherwise links and the connector sign-in use the wrong address.
      - PROTOCOL_HEADER=x-forwarded-proto
      # - HOST_HEADER=x-forwarded-host
    volumes:
      - jimu-data:/app/data
    restart: unless-stopped

volumes:
  jimu-data:
```

```bash
docker compose up -d
```

The container applies pending database migrations every time it starts. Back up the database
file before updating, for example:

```bash
docker cp jimu:/app/data/sqlite.db ./jimu-backup.db
```

To build the image yourself instead:

```bash
docker build -t jimu .
```

### Manual build

```bash
pnpm build
DATABASE_URL=/path/to/sqlite.db pnpm db:migrate
DATABASE_URL=/path/to/sqlite.db PORT=3000 node build
```

## Connecting Claude or ChatGPT

jimu has a built-in [MCP](https://modelcontextprotocol.io) server at `/mcp`, in the same process
as the app. Add it as a custom connector in Claude (Settings → Connectors) or ChatGPT; Settings →
Connected apps in jimu shows the exact address to copy.

Signing in uses OAuth: you approve the connection on a jimu consent page. Leave "Can make changes"
unticked to keep it read-only. Connected apps are listed in Settings, where you can disconnect
them at any time.

| Tools | |
|---|---|
| Read | `list_exercises`, `get_exercise_log`, `get_sessions`, `list_routines`, `list_splits` |
| With "Can make changes" | `create_exercise`, `update_exercise`, `log_sets`, `create_routine`, `update_routine`, `create_split`, `update_split` |

There are no delete tools. Changes made by the assistant reach your devices like an edit from
another device.

Claude Code connects from your own computer, so it works with any address that computer can reach
(including over a VPN). claude.ai, the Claude apps and ChatGPT connect from their providers'
servers and need a public HTTPS address.

### App on a VPN, connector through a tunnel

If jimu itself should stay private, expose only the connector paths under a separate public name
and tell jimu about both names:

```yaml
      - CONNECTOR_URL=https://jimu-mcp.example.com   # public: what the connector talks to
      - APP_URL=https://jimu.example.com             # private: where you approve in your browser
```

On the `CONNECTOR_URL` name jimu then answers only `/mcp`, `/oauth/token` and the OAuth
discovery documents (`/.well-known/oauth-protected-resource`,
`/.well-known/oauth-authorization-server`); everything else is a 404. The consent page opens on
`APP_URL` in your browser, where you're signed in over the VPN. A value with anything after the
host stops the server at startup with an explanation.

With a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/),
let only those paths through as well:

```yaml
ingress:
  - hostname: jimu-mcp.example.com
    path: "^/(mcp|oauth/token)$"
    service: http://localhost:3000
  - hostname: jimu-mcp.example.com
    path: "^/\\.well-known/oauth-(protected-resource|authorization-server)(/mcp)?$"
    service: http://localhost:3000
  - service: http_status:404
```

To go further, allow only the connector's provider to reach that name, e.g. with a Cloudflare WAF
rule that blocks requests to it from outside Anthropic's
[published outbound IP range](https://platform.claude.com/docs/en/api/ip-addresses).

## Development

**Prerequisites:** Node.js 22+, pnpm

```bash
pnpm install
```

Point the app at a SQLite file (or put the line into `.env`):

```bash
export DATABASE_URL=./local.db
```

Create the database and start the dev server:

```bash
pnpm db:migrate
pnpm dev
```

The app runs at `http://localhost:3000` and is reachable on your local network (`--host`). The
first account you sign up is the admin.

| Command | Description |
|---|---|
| `pnpm test` | Unit tests (vitest): sync merge, splits schedule, sessions |
| `pnpm check` | Type-check with svelte-check |
| `pnpm format` | Format with Prettier |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio to inspect the database |
