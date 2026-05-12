# King Soopers Shopping List

A small-group web app (portable to mobile later) for building a shopping list, matching each typed item to a real product at the user's Kroger store, remembering the user's selection so the next entry of the same text auto-resolves, and (optionally) pushing the final list to the Kroger cart.

## State of the project

- **Status:** Rescoped 2026-05-02 from "Kroger Coupon Clipper" to "King Soopers Shopping List". M1 + M2 still done. Everything coupon-related (worker, scraper, kroger.com creds, BullMQ, Redis, CouponSnapshot, KrogerCredential) has been removed. The current app runs at `http://localhost:3000`: auth, Kroger OAuth, store picking, and naive product matching (top-1 result, no remembering) all work. Next milestone (M3-new) is search-and-remember.
- **Audience:** the user + ~5–20 family/friends. Not a public/SaaS app.
- **User's banner:** **King Soopers**. Their developer-API client_id is `kingsoopersapp-*`. Their app home store is `62000138` (King Soopers store #00138 — 2900 Arapahoe Rd, Erie CO 80026).

## What the app does (target shape)

For each item the user types into a list:
1. Search Kroger Public API at the user's home store and show several candidate products.
2. The user picks the exact product they want.
3. Persist the selection so the next time they type the same text (normalized), the matched product is auto-resolved.
4. Optional: an explicit "Send to Kroger cart" button on the finalized list calls the Kroger Public API `cart` endpoint with the chosen UPCs.

## Stack (actual versions in use)

- **Web:** Next.js 15.5.x App Router + TypeScript, Tailwind 4, Auth.js v5 (`5.0.0-beta.25`) Credentials + JWT, Argon2id (`@node-rs/argon2`)
- **DB:** Postgres 16 + Prisma 6
- **Layout:** pnpm 10 workspaces — `apps/web` + `packages/{shared,db,crypto}`
- **Hosting:** local Docker Compose only. No cloud.
- **Crypto:** **node:crypto AES-256-GCM** (used to encrypt Kroger OAuth tokens at rest)

## Two auth layers — keep them straight

1. **App login** — Auth.js v5, email + password (Argon2id), JWT cookie. Table: `User`. **Done.**
2. **Kroger Public API per-user OAuth** — auth_code + PKCE, scopes `product.compact cart.basic:write profile.compact`. Tokens AES-GCM-encrypted at rest with `MASTER_KEY`. Redirect URI: `http://localhost:3000/api/kroger/callback`. Table: `KrogerOAuth`. **Done.** Refresh tokens go stale within a few days (Kroger rotates aggressively); `getValidAccessToken` deletes the row on 401 so the user is prompted to reconnect.

These two are independent. A change to one should not touch the other.

## Critical files (current)

Implemented:
- `packages/crypto/src/envelope.ts` — AES-256-GCM envelope encrypt/decrypt; `encryptToString` / `decryptFromString` pack `nonce:ciphertext` for single-column storage.
- `packages/shared/src/kroger.ts` — Public API client: PKCE, `buildAuthorizeUrl`, `exchangeCode`, `refreshAccessToken`, `searchLocations`, `getLocation`, `searchProducts`, `productToSnapshot`. Single file; cart-write helpers will land here.
- `packages/db/prisma/schema.prisma` — `User` (with `homeLocationId`), `KrogerOAuth`, `ShoppingList`, `ShoppingListItem`, `ItemMatch`.
- `apps/web/{auth.ts, auth.config.ts, middleware.ts}` — Auth.js v5 split (auth.ts is Node-only with Prisma+Argon2; auth.config.ts is edge-safe).
- `apps/web/lib/kroger.ts` — `getValidAccessToken(userId)` (refreshes + auto-cleanup on 401), `krogerEnv()`.
- `apps/web/app/api/kroger/{connect,callback}/route.ts` — Kroger Public API OAuth.
- `apps/web/app/{settings,list,dashboard}/page.tsx` — UI. Settings shows home-store address via `getLocation`. List currently does naive top-1 matching via `submitListAction`.

Coming in M3-new (search-and-remember):
- New Prisma model `ItemMatch` keyed by `(userId, normalizedQuery)` → chosen product (UPC + snapshot).
- Replace top-1 auto-match with: typed query → list of candidates → user picks → match persisted.
- Reuse on next entry: normalize query, look up `ItemMatch`, fall back to candidate-picker UI.

Coming in M4-new (cart push):
- `addToCart` helper in `packages/shared/src/kroger.ts` against the Kroger Public API `cart` endpoint (`PUT /v1/cart/add`).
- "Send to Kroger cart" button on the finalized list page.

## Dev commands (run from `/Users/daniel/dev/kroger`)

- `pnpm install` — sync workspace deps
- `pnpm stack:up` — start the Docker stack (postgres + web)
- `pnpm stack:down` — stop
- `pnpm stack:build` — rebuild + start (after **code** changes; `.env`-only changes just need `stack:down && stack:up`)
- `pnpm stack:logs` — tail
- `pnpm db:migrate --name <name>` — create + apply a Prisma migration (must `set -a && source .env && set +a` first; see Gotchas)
- `pnpm db:studio` — Prisma Studio
- `cd apps/web && pnpm exec tsc --noEmit` — type-check the web app

## Gotchas (general — learned the hard way)

- **`pnpm up` is `pnpm update`.** Don't name a script `up` — it gets shadowed silently. Same family: `install`, `add`, `i`. Our scripts use `stack:*`.
- **Prisma can't see `.env` from the workspace root** when running migrations from monorepo root. Workaround: `set -a && source .env && set +a && pnpm db:migrate ...`.
- **Don't set `declaration: true` in the base tsconfig.** With pnpm's strict (non-flat) `node_modules` and packages re-exporting types from external modules (next-auth in particular), TS emits `TS2742 "inferred type cannot be named without a reference to..."`. Apps don't need declaration emit; workspace packages export TS source via `"main": "./src/index.ts"` + Next.js `transpilePackages`.
- **pnpm 10 blocks postinstall scripts by default.** Root `package.json`'s `pnpm.onlyBuiltDependencies` allowlist must include any deps with native bindings or generators (`@node-rs/argon2`, `@prisma/client`, `@prisma/engines`, `@tailwindcss/oxide`, `esbuild`, `prisma`, `sharp`).
- **OAuth redirect URI must match exactly.** `http://localhost:3000/api/kroger/callback`. No trailing slash. Don't use `127.0.0.1`.
- **Source is baked into the Docker image at build time** (no bind mount). Code changes need `pnpm stack:build`. `.env` changes only need `stack:down && stack:up`. Schema changes need `pnpm db:migrate` on host **and** `stack:build` (so the container's generated Prisma client matches).
- **Containers in Docker Desktop are grouped by compose project name.** Look for `kroger` in the Containers tab; both services nest under it.
- **`/locations/{id}` returns `{data: <single>}`**, not `{data: [...]}` (the search endpoint shape). Schemas are split in `kroger.ts` accordingly.
- **The user's locationId format is `<3-digit-banner-prefix><5-digit-store>`** (e.g., King Soopers `62000138` → store #00138). The banner prefix for King Soopers is `620`. Other banners have other prefixes.
- **Refresh tokens go stale fast.** Kroger rotates / revokes refresh tokens within a few days. `getValidAccessToken` deletes the OAuth row on 401 from the token endpoint so the user is prompted to reconnect on the next page load. The home-store choice (`User.homeLocationId`) is deliberately stored on `User`, NOT on `KrogerOAuth`, so the row deletion on 401 doesn't wipe the user's preference.
- **`/products` won't return prices reliably without `filter.fulfillment`.** With only `filter.locationId`, many products come back with no `price` field at all (just `itemId`/`size`/`inventory`). Adding `filter.fulfillment=ais` (aisle/in-store) makes pricing show consistently. `searchProducts` defaults to `ais`; override via the `fulfillment` option if needed (`csp` for curbside, `dug` for drive-up, `del` for delivery, `sth` for ship-to-home). Tradeoff: products only available online get filtered out — fine for an in-store shopping list.

## Phased delivery

- **M1** Skeleton + app auth — **DONE**
- **M2** Kroger OAuth + product search — **DONE**
- **M3-new** Search-and-remember (candidates UI + `ItemMatch` table) — **NEXT**
- **M4-new** Optional "Send to Kroger cart" button (Public API `cart` write)
- **M5** PWA polish + LAN-accessible mobile install

## Decisions explicitly ruled out

- HTTP-only coupon clipping (CSRF blocks it) — moot now that coupons are out of scope.
- Coupon scraping via Playwright on kroger.com — removed 2026-05-02 with the rescope.
- Cloud KMS or zero-knowledge credential encryption (overkill for 5–20 users)
- Cloud hosting for the first release (user wants $0, fully local)
- Public sign-up / SaaS
- Phone access from cellular for the first release (LAN-only)
- Auth.js DB sessions (Credentials + JWT is enough)

## Open questions (non-blocking; do not decide silently)

- M3-new: query-normalization strategy for `ItemMatch` lookups (lowercase + trim is the floor; do we go further — strip punctuation, collapse whitespace, ignore stopwords, remove pluralization? Start minimal, iterate).
- M3-new: when an `ItemMatch` exists but the matched product is no longer returned by the API (discontinued, out of stock at this store), what's the UX? Show stale snapshot + a "rematch" affordance?
- M3-new: should picks be store-scoped (`userId + locationId + normalizedQuery`) or store-agnostic (`userId + normalizedQuery`)? Probably store-scoped since prices, sizes, and availability differ by store, but that means rebuilding history if the user changes home stores.
- M4-new: how to handle items the user selected but no longer available at cart-push time?
- Multi-store households (one Kroger account, two preferred stores).
- Remote access path (Tailscale vs Cloudflare Tunnel vs real deploy) — deferred until after first release.

## Working principles for this codebase

- The two auth layers are independent — keep their code, tables, and envs separated.
- Match-confirmation UI stays in the loop (the whole point of M3-new is letting the user pick the exact product).
- Cart-push is opt-in, behind an explicit button. Never push to the cart implicitly.
- No paid cloud dependencies until the user explicitly asks for a deploy.
- Don't reach for `shadcn/ui` or `Turbo` until we have evidence the milestone needs them.
