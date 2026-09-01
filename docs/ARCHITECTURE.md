# SplashNet × JuanFi — Architecture & Ownership

Companion to [GLOSSARY.md](./GLOSSARY.md) (terms) and [API.md](./API.md)
(endpoints). This document answers: **what runs where, who owns it, what
talks to what, and which change requires touching what.**

---

## 1. Component map

```
                          ┌──────────────────────────── CLOUDFLARE EDGE ───────────────────────────┐
                          │  splash.nxph.site        cdn.nxph.site     demo.nxph.site  vendo.nxph.site
                          └──────┬───────────────────────┬──────────────────┬──────────────┬───────┘
                                 │      Cloudflare Tunnel (cloudflared, systemd)          │
        ┌────────────────────────┼───────────────────────┼──────────────────┼──────────────┘
        │                        │                       │                  │
┌───────▼────────┐   ┌───────────▼──────────┐  ┌─────────▼───────┐  ┌───────▼────────┐
│ SplashNet app  │   │ MinIO (assets)       │  │ sim portal      │  │ sim vendo      │
│ Next.js 16     │   │ bucket: splashnet-   │  │ (nginx, patched │  │ (node: coin API│
│ (standalone,   │   │  assets → cdn)       │  │  JuanFi portal) │  │  + real admin) │
│  systemd)      │   └──────────────────────┘  └─────────────────┘  └────────────────┘
│ :3000          │
└──┬──────────┬──┘
   │          │
┌──▼─────┐ ┌──▼─────┐     ┌─────────────────────────────────────────────┐
│Postgres│ │ Redis  │     │ PRODUCTION GATEWAYS (per operator site)     │
│  :5432 │ │ :6379  │     │ MikroTik router                             │
└────────┘ └────────┘     │  ├─ hotspot/  ← fork template (installed ONCE)│
                          │  │    └─ splash.js ← served BY SplashNet     │
                          │  └─ walled garden (2 hostnames, ONCE)        │
                          │ Vendo box (NodeMCU) — NEVER TOUCHED by us      │
                          │  └─ (optional overlay: see FIRMWARE-POLICY)   │
                          └─────────────────────────────────────────────┘
```

**Ownership boundaries (GUARD-01):** SplashNet is a web app + API only. The
operator owns routers, cabling, power, ISP. We never require remote access
to gateway hardware after install.

## 2. Data flow — the four lifecycles

**Ad serve (hot path, ~4 ms app time):**
`SDK (portal) → GET /api/v1/ad/fetch` → Redis cache-only lookup (8-key
MGET chain: specific → wildcard over city/env/target) → payload + optional
reward token → hit appended to `ad_hits` (with vendor + geo signals).

**Reward & money:**
`SDK engagement → POST /api/v1/ad/reward` (HMAC token, single-use, device
quota 3/day, **budget check**) → voucher issued, `cost_php` debited from
campaign budget, `vendor_id` credited → `POST /api/v1/ad/redeem` (connector;
idempotent burn) → hotspot session provisioned.

**Retarget (no-touch ops):**
Admin edits `sites` row → SDK's next `/api/v1/sdk/config` fetch (60 s cache)
picks it up → portal behaves differently. Nothing re-uploaded.

**Content update:**
Advertiser/Operator uploads image (WebP pipeline, 150 KB cap) → CDN; video
`mc`-loaded → CDN; campaign points at URL. Portals fetch creatives per
serve — no storage anywhere downstream.

## 3. Change-impact matrix (the no-false-assumptions table)

| Change | Server (deploy) | DB/Redis | Portal re-upload? | Vendo re-flash? | Operator action |
|---|---|---|---|---|---|
| New campaign / creative | — | rows | **No** | No | none |
| Budget / cost-per-engagement | — | rows | No | No | none |
| Retarget a site (city/cluster/area/vendor) | — | row edit | **No** | No | none |
| Change coin gate / ad format per site | — | row edit | **No** | No | none |
| SDK update (bugfix/feature) | deploy | — | **No** (self-updating, no-store) | No | none |
| Daily device reward cap | deploy (constant) | — | No | No | none |
| Server infrastructure (DB/Redis/tunnel) | deploy | — | No | No | none |
| Fork template changes (UI layout, free-first) | — | — | **Yes — rebuild + upload** | No | one file copy |
| Vendor income surface | deploy (hosted page) | — | No | **No — never** | none (bookmark splash.nxph.site/vendor) |
| Vendo admin page update (optional overlay) | — | — | No | SPIFFS re-image at owner's risk (FIRMWARE-POLICY.md) | BACKUP→flash→RESTORE protocol |
| New gateway deployment | — | register site + vendor | initial upload (ONCE) | initial upload (ONCE) | walled garden cmds |
| Reward voucher → real hotspot session | Module C connector | — | No | firmware extension (Module C scope) | Module C install |

**The one line that matters:** after initial install, every routine change
is a server-side operation. Re-uploads are reserved for portal *layout*
changes only, and even those are self-updating once the SDK loads.

## 4. Identity & attribution model (cohesion)

| Entity | ID shape | Created by | Owns / attributes |
|---|---|---|---|
| Advertiser | `adv_*` | SplashNet admin | campaigns, creatives, footprint |
| Vendor (operator) | `VND-XXXX` + `vnk_…` key | SplashNet admin | sites, gateways, uploads; earns income |
| Site (gateway deployment) | `SITE-XXXX` | SplashNet admin | portal config: targeting/format/gate |
| Campaign | `cmp_*` | SplashNet admin | inventory + budget + reward settings |
| Advertiser-side geo | areas `CITY-NAME` | registry | targeting dictionary |

Every `ad_hits` row carries gateway + vendor + declared city + Cloudflare
geo; every `ad_rewards` row carries campaign + vendor + cost — making
advertiser billing, vendor income, and fraud analysis (Module B) pure SQL.

## 5. Failure posture (fail-open everywhere)

| Failure | Behavior |
|---|---|
| Ad API slow/down (SDK) | Ad hidden at 150 ms; portal continues; gate countdowns still unlock |
| Config endpoint down (site mode) | SDK falls back to embedded `data-*` attributes |
| Redis down | Rate limiting bypassed; API serves fallback; logs CACHE_DEGRADED |
| Advertiser budget exhausted | Rewards denied → `splashnet:paid-mode` → coin slot revealed |
| CDN unreachable pre-auth | Text creative still renders; media skipped |

Rule: **ad infrastructure can degrade monetization; it can never block a
user from the internet or an operator from coins.**

## 6. Security posture

- Admin: session cookies (scrypt, DB-backed), RBAC (ADMIN/OPERATOR/VIEWER);
  admin APIs same-origin, session-guarded.
- Public endpoints (ad fetch, reward, redeem, sdk config, vendor metrics):
  no session — protected by HMAC tokens, single-use Redis NX, device quotas,
  per-IP rate limits, and vendor API keys respectively.
- Wildcard CORS **only** on public ad endpoints (portals are arbitrary
  origins); preflight-free GET for fetch.
- Secrets: `/etc/splashnet/splashnet.env` (600) on the host; `.env.local`
  gitignored; repo `.env` never read by the app.
- Every reward and redemption is ledgered (`ad_rewards`) for audit/Module B.

## 7. Backup & durability

systemd units (boot-enabled, restart-always): app, tunnel, postgres, redis,
minio. Daily 03:00 `pg_dump` (7-day retention, verified). Redis is a cache
(write-through) — loss costs a re-index, not data. MinIO bucket on local
disk — R2 replication is the production-cloud step.

## 8. Environments

| Env | What | Where |
|---|---|---|
| Local dev (memory) | zero-infra, seeded | `npm run dev` |
| Local full stack | PG+Redis+MinIO, `.env.local` | `npm run build && npm start` / systemd `splashnet` |
| Sim | JuanFi portal + mock vendo (Docker) | `sim/docker-compose.yml` (`:8888`, `:8081`) — also publicly at `demo`/`vendo.nxph.site` |
| Production cloud (future) | same app on VPS/managed DBs; R2 assets | env-only switch (see README) |
