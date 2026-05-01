# jimu

A local-first workout tracker. Exercises and sets are stored in IndexedDB in the browser and synced to a SQLite backend when online.

## Development

**Prerequisites:** Node.js 20+, pnpm

```bash
pnpm install
```

Set the database URL (SQLite file path):

```bash
export DATABASE_URL=./local.db
```

Push the schema and start the dev server:

```bash
pnpm db:push
pnpm dev
```

The app runs at `http://localhost:3000` and is accessible on the local network (`--host` is set by default).

### Other dev commands

| Command | Description |
|---|---|
| `pnpm check` | Type-check with svelte-check |
| `pnpm db:studio` | Open Drizzle Studio to inspect the database |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |

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
      - ORIGIN=https://your-domain.com
    volumes:
      - jimu-data:/app/data
    restart: unless-stopped

volumes:
  jimu-data:
```

Set `ORIGIN` to the URL the app will be served from (required by SvelteKit for CSRF protection).

```bash
docker compose up -d
```

### Building the Docker image yourself

```bash
docker build -t jimu .
```

The image runs `drizzle-kit migrate` on startup before launching the Node server, so no manual migration step is needed.

### Manual build

```bash
pnpm build
DATABASE_URL=/path/to/sqlite.db node build/index.js
```
