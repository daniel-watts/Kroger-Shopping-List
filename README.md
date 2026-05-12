# King Soopers Shopping List

A small-group web app for building a shopping list, matching each typed item to a real product at your King Soopers / Kroger store, remembering your selection so the next entry of the same text auto-resolves, and (optionally) pushing the final list to the Kroger cart.

Audience: yourself + ~5–20 family/friends. Not a public/SaaS app. Runs locally via Docker Compose — no cloud dependencies.

## How it works

For each item you type:

1. Search the Kroger Public API at your home store for candidate products.
2. Pick the one you want.
3. The choice is persisted, so next time you type the same text it auto-resolves.
4. Optional: send the finalized list to your Kroger cart with one click.

## Stack

- **Web:** Next.js 15 App Router + TypeScript, Tailwind 4
- **Auth:** Auth.js v5 (Credentials + JWT), Argon2id password hashing
- **DB:** Postgres 16 + Prisma 6
- **Layout:** pnpm 10 workspaces — `apps/web` + `packages/{shared,db,crypto}`
- **Crypto:** node:crypto AES-256-GCM (encrypts Kroger OAuth tokens at rest)
- **Hosting:** local Docker Compose

## Prerequisites

- Node 20+
- pnpm 10
- Docker Desktop
- A Kroger developer app — register at <https://developer.kroger.com/> to get a client id/secret. Set the redirect URI to `http://localhost:3000/api/kroger/callback`.

## Quick start

```bash
# 1. Install deps
pnpm install

# 2. Configure environment
cp .env.example .env
# then fill in AUTH_SECRET, MASTER_KEY, KROGER_CLIENT_ID, KROGER_CLIENT_SECRET
# generate secrets with: openssl rand -base64 32

# 3. Bring up the stack (postgres + web)
pnpm stack:up

# 4. Apply database migrations
set -a && source .env && set +a
pnpm db:migrate
```

App is now running at <http://localhost:3000>. Sign up, then in **Settings** connect your Kroger account and pick a home store.

## Repo layout

```
apps/web/         Next.js app (UI, server actions, API routes)
packages/shared/  Kroger Public API client (PKCE, search, cart)
packages/db/      Prisma schema + client
packages/crypto/  AES-256-GCM envelope encryption
infra/            Docker Compose + Dockerfile
```

## Dev commands

Run from the repo root.

| Command | What it does |
| --- | --- |
| `pnpm stack:up` | Start the Docker stack |
| `pnpm stack:down` | Stop |
| `pnpm stack:build` | Rebuild + start (use after code changes) |
| `pnpm stack:logs` | Tail logs |
| `pnpm db:migrate --name <name>` | Create + apply a Prisma migration |
| `pnpm db:studio` | Open Prisma Studio |
| `cd apps/web && pnpm exec tsc --noEmit` | Type-check the web app |

## Two auth layers

These are independent — a change to one shouldn't touch the other.

1. **App login** — email + password, Argon2id, JWT cookie. Table: `User`.
2. **Kroger Public API per-user OAuth** — auth_code + PKCE, scopes `product.compact cart.basic:write profile.compact`. Tokens AES-GCM-encrypted at rest with `MASTER_KEY`. Table: `KrogerOAuth`.

Kroger rotates refresh tokens aggressively (often within days). When a refresh fails with 401, the OAuth row is deleted and the user is prompted to reconnect on the next page load. The home-store choice lives on `User.homeLocationId`, not on `KrogerOAuth`, so reconnects don't wipe the preference.

## Gotchas

- **`pnpm up` is `pnpm update`.** Don't name a script `up` — it gets shadowed silently. The scripts here use `stack:*`.
- **Prisma can't see `.env` from the workspace root** when running migrations. Workaround: `set -a && source .env && set +a` first.
- **Source is baked into the Docker image at build time** — code changes need `pnpm stack:build`. `.env`-only changes just need `stack:down && stack:up`. Schema changes need `pnpm db:migrate` on the host **and** `stack:build`.
- **OAuth redirect URI must match exactly:** `http://localhost:3000/api/kroger/callback`. No trailing slash. Don't use `127.0.0.1`.
- **pnpm 10 blocks postinstall scripts by default.** The root `package.json`'s `pnpm.onlyBuiltDependencies` allowlist must include any dep with native bindings or generators.
- **`/products` won't return prices reliably without `filter.fulfillment`.** The client defaults to `ais` (in-store). Tradeoff: online-only products get filtered out, which is fine for an in-store list.

## Status

- **M1** Skeleton + app auth — done
- **M2** Kroger OAuth + product search — done
- **M3** Search-and-remember (candidates UI + `ItemMatch` table) — in progress
- **M4** Optional "Send to Kroger cart" button
- **M5** PWA polish + LAN-accessible mobile install
