# Architecture QA Report — 2026-09-02

Scope: every claim in [ARCHITECTURE.md](./ARCHITECTURE.md) tested against
the live system — infrastructure, the four lifecycles, the change-impact
matrix, the failure posture (including a real Redis outage), and the
security posture.

## L0 — Gates

`next build` 0 errors · ESLint clean · unit 6/6 · API matrix **32/32**
(`scripts/qa-matrix.py`, idempotent).

## L1 — Infrastructure

| Claim | Result |
|---|---|
| 6 systemd units boot-enabled & active (app, tunnel, pg, redis, minio, backup timer) | ✅ all enabled/active |
| Tunnel serves 4 hostnames | ✅ splash (health 200), cdn (asset 200), demo (portal 200), vendo (API 200) |
| Daily backups, 7-day retention | ✅ Aug 31 + Sep 1 dumps present, 32 tables each; next fire on schedule |
| Secrets hygiene | ✅ `/etc/splashnet/splashnet.env` mode 600; `.env*` + `.env.local` gitignored |

## L2 — The four lifecycles

| Lifecycle | Result |
|---|---|
| **Ad serve** | ✅ hot path 12.5 ms min / 17 ms avg local (Server-Timing present) |
| **Reward & money** | ✅ covered by matrix (grant → cost debit → idempotent burn → vendor credit) |
| **Retarget** | ✅ site flipped `JUANFI-SIM → RETAIL-ZONE` server-side; config endpoint reflected it; serving followed; reverted. Zero portal action |
| **Content update** | ✅ creative served from `cdn.nxph.site` — no downstream storage |

## L3 — Failure posture (real outage drills)

**⚠ DEFECT FOUND & FIXED — Redis outage hung the ad API.** With Redis
stopped, `/ad/fetch` and `/ad/reward` **hung to timeout** (ioredis offline
queue buffers commands while disconnected) instead of failing open —
violating the architecture's fail-open guarantee at the worst moment (an
outage). **Fix:** fail-fast Redis client (`enableOfflineQueue: false`,
`maxRetriesPerRequest: 1`, 500 ms command timeout). Re-tested with Redis
down:

| Scenario (Redis down) | Before fix | After fix |
|---|---|---|
| `/ad/fetch` | hang → timeout | ✅ **200 FALLBACK in 14 ms** |
| `/ad/reward` | hang → timeout | ✅ fast DENIED (fail-closed on money) |
| Rate limiting | — | ✅ bypassed (70/70 rapid fetches, 200s in 0.4 s) |
| Recovery after Redis restart | — | ✅ immediate, healthy |

**Config-endpoint failure fallback** — portal embed with a nonexistent site
key (`SITE-FFFFFF`) fell back to its embedded `data-*` attributes and served
the correct campaign. ✅ (fail-open targeting)

## L4 — Security posture

| Check | Result |
|---|---|
| Rate limit active with Redis up (70 rapid fetches, spoofed IP) | ✅ 60×200 then 10×429 |
| Vendor metrics: bad key / no key | ✅ 401 / 401 |
| CORS scope: wildcard **only** on public ad endpoints | ✅ ad fetch `*`; admin endpoints no CORS |
| Session guards + RBAC | ✅ (matrix) |

## Verdict

Architecture claims verified end-to-end; one genuine defect (Redis outage
hang) discovered by the outage drill and fixed — the exact class of bug this
QA layer exists to catch. System state after QA: all services healthy,
Redis up, demo site restored (`JUANFI-SIM`, 5 s gate).
