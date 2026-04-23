FROM node:20-slim AS builder
WORKDIR /app
RUN npm install -g pnpm

ARG DATABASE_URL=/app/data/sqlite.db

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

COPY . .

# Create the data directory before build
RUN mkdir -p /app/data

ENV DATABASE_URL=${DATABASE_URL}
RUN pnpm build

FROM node:20-slim AS runner
WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx drizzle-kit migrate && node ./build/index.js"]
