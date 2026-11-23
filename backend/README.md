# Obsid backend

API for Obsid, a sealed bid launchpad on BNB Chain. Hosts are public; buyers are private.

Stack: Node 22, TypeScript (compiled to `dist/` with `tsc`), Express 5, zod, viem, pg.

## Privacy rule

The backend stores **nothing about buyers**: no bids, no buyer wallets, no request or IP logging.
It only persists hosts, applications, sales metadata (aggregates such as `totalCommittedBnb` and
`bidCount` pushed by the admin), host profile change requests and short-lived sign-in nonces.
There is no request logger. The rate limiter keeps per-IP counters in process memory for its
window only; nothing is written to the database.

## Run locally

```bash
npm install
npm run dev        # tsx watch, in-memory store unless DATABASE_URL is set
npm test           # vitest + supertest against the in-memory store
npm run build      # tsc -> dist/
npm start          # node dist/index.js
SEED_DEMO=true npm run dev   # with demo hosts and sales
```

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `8080` | Railway sets this. |
| `DATABASE_URL` | (unset) | Postgres connection string. Unset = in-memory store. Tables are created on boot (idempotent migrations tracked in `schema_migrations`). |
| `PGSSL` | `false` | `true` enables TLS (`rejectUnauthorized: false`) for public Postgres URLs. |
| `ADMIN_WALLET` | `0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76` | Case insensitive. |
| `CORS_ORIGIN` | `https://www.obsid.site,https://obsid.site,http://localhost:3000` | Comma separated. |
| `SEED_DEMO` | `false` | `true` seeds demo data when there are no hosts. |
| `RATE_LIMIT_MAX` | `600` | Requests per IP per 15 min across `/api`. |
| `NONCE_RATE_LIMIT_MAX` | `30` | Nonce requests per IP per minute. |
| `BODY_LIMIT` | `100kb` | JSON body limit. |
| `TRUST_PROXY` | `1` | Proxy hops to trust for client IP (Railway = 1). |

## Auth

1. `GET /api/auth/nonce?address=0x...` returns `{ nonce, message, expiresAt }` where
   `message = "Sign in to Obsid\nAddress: <checksummed address>\nNonce: <nonce>"`.
2. Sign `message` with the wallet (`personal_sign`).
3. Send `x-address`, `x-signature`, `x-nonce` headers on the authenticated request.

Nonces are single use and expire after 10 minutes. Every authenticated request needs a fresh nonce.
The admin is the wallet in `ADMIN_WALLET`.

## Endpoints

Public:

- `GET /health` -> `{ ok: true }`
- `GET /api/hosts` -> `Host[]` (each with `sales: Sale[]`)
- `GET /api/hosts/:slug` -> `Host & { sales: Sale[] }`
- `GET /api/sales?type=ICO|IDO|PRESALE&hostId=` -> `Sale[]`
- `GET /api/sales/:id` -> `Sale`
- `GET /api/auth/nonce?address=0x...`

Host (signed):

- `GET /api/hosts/me` -> `{ host, pendingChange }`
- `POST /api/hosts` -> create or update own profile. Body: `name, logo, banner, bio, links{website,x,telegram,discord,docs}, team[{name,role}]`, optional `wallet`.
  Returns `{ host, pendingChange }`. Slug is derived from name. New hosts are `verified: false`.
  For verified hosts, `name` and `wallet` changes become a pending profile change for the admin; other fields apply directly.
- `POST /api/applications` -> body `type (ICO|IDO|PRESALE; IPO is "coming soon"), tokenName, tokenSymbol, tokenAddress?, supply, minPrice, softCapBnb, hardCapBnb, start, end, revealEnd, escrowAtClosePct, milestones[{label,pct}], summary`.
  Rules: hardCap > softCap, start in the future, start < end < revealEnd, `escrowAtClosePct + sum(milestones.pct) = 100`.
- `GET /api/applications/mine`

Admin (signed by `ADMIN_WALLET`, otherwise 403):

- `GET /api/admin/applications?status=pending|approved|rejected`
- `POST /api/admin/applications/:id/approve` body `{ contractAddress? }` -> creates the sale (upcoming, cold, zero totals) and verifies the host
- `POST /api/admin/applications/:id/reject` body `{ reason }`
- `PATCH /api/admin/sales/:id` body `{ contractAddress?, status?, totalCommittedBnb?, bidCount?, clearingPrice?, milestonesReleased?: boolean[] }`
- `GET /api/admin/profile-changes?status=`
- `POST /api/admin/profile-changes/:id/approve`
- `POST /api/admin/profile-changes/:id/reject` body `{ reason? }`

Sale `status` is computed from timestamps (`upcoming` before start, `bidding` until end, then `reveal`)
unless it has been set to `settled` or `failed`. `heat` is computed from `totalCommittedBnb / hardCapBnb`
(<25% cold, <60% warm, <90% hot, else on fire).

## Deploy on Railway

1. Create a service from this repo with **Root Directory** set to `backend`.
2. Add a Postgres database and set `DATABASE_URL=${{Postgres.DATABASE_URL}}` on the service.
3. Optionally set `ADMIN_WALLET`, `CORS_ORIGIN`, `SEED_DEMO`.
4. `railway.json` configures build (`npm run build`), start (`npm start`) and the `/health` healthcheck.
   Node 22 is pinned via `.nvmrc` (`engines.node >= 20`).
5. Generate a public domain and point the frontend's `NEXT_PUBLIC_API_URL` at it.
