# SplashNet API Reference

Base URL (production): `https://splash.nxph.site`
All responses JSON unless noted. Errors: `{"error": "message"}` (admin APIs)
or `{"status": "DENIED", "reason": "..."}` (reward family).

Auth markers per endpoint: **[public]** callable from captive portals (no
auth, wildcard CORS, fail-open); **[session]** requires an admin session
cookie; **[role]** minimum role.

Rate limits: `/ad/fetch` 60 req/min/IP; `/ad/reward` 20 req/min/IP. Over
limit → 429 (fetch) / 429 DENIED (reward).

---

## Ad delivery

### GET|POST `/api/v1/ad/fetch` — [public]
Deterministic hourly ad for the requesting gateway. GET query params or POST
JSON body (S2S). **No CORS preflight** (simple GET, no custom headers) —
required for pre-auth captive portals.

Params:
| Name | Required | Notes |
|---|---|---|
| `city` | yes | City code, e.g. `DVO` |
| `type` | yes | `PISO_WIFI` \| `POSTPAID` |
| `cluster` | no | Cluster ID for operator-zone targeting (takes precedence over `area`) |
| `area` | no | Registry area code (e.g. `DVO-AGDAO`) for drill-down targeting |
| `vendor` | no | `VND-XXXX` vendor attribution |
| `gateway` | no | Router MAC/ID; device key for rewards & analytics (also accepts `mac`) |

200 response:
```json
{
  "status": "OK",                  // OK | FALLBACK
  "campaignId": "cmp_xxx",
  "creative": {
    "headline": "…", "body": "…",
    "ctaLabel": "…", "ctaUrl": "…",
    "imageUrl": "https://cdn.nxph.site/splashnet-assets/x.webp",   // optional
    "videoUrl": "https://cdn.nxph.site/splashnet-assets/x.mp4",    // optional
    "bgColor": "#065f46", "textColor": "#ecfdf5"
  },
  "reward": {                      // present only when campaign pays rewards
    "minutes": 5,
    "token": "<signed single-use token, 10-min TTL>"   // absent on FALLBACK
  },
  "slotHour": 14,
  "timestamp": "2026-09-01T06:00:00.000Z"
}
```
400 missing/invalid params. Internal failure still returns a FALLBACK
payload with HTTP 200 (fail-open — portals must never be blocked). Latency
budget: ~4 ms app time (see `Server-Timing` header).

### POST `/api/v1/ad/reward` — [public]
Redeem ad engagement for free minutes. Called by the SDK after the user
watches ≥ 8 s (`WATCH`) or clicks the CTA (`CLICK`).

Body: `{ "token": "<from ad/fetch reward.token>", "engagement": "WATCH" | "CLICK" }`

Responses:
- 200 `{"status":"GRANTED","minutes":5,"voucher":"SN4F86B9E4"}`
- `DENIED` + reason: `invalid or expired token` (403) · `token already
  redeemed` (409) · `daily device limit reached` (device cap 3/24 h) ·
  `rate limited` (429) · `temporarily unavailable` (503, fail-closed on
  reward errors — deny, never block)

### POST `/api/v1/ad/redeem` — [public, live]
Gateway redemption contract (connector). Convert a reward voucher into
minutes to provision on the hotspot. Idempotent per gateway: first call burns
the voucher; the same gateway retrying gets the identical grant; a different
gateway is refused.

Body: `{ "voucher": "SN4F86B9E4", "mac": "AA:BB:CC:DD:EE:FF" }` (also accepts
`gateway` instead of `mac`; voucher format `SN` + 8 hex)

200 `{"status":"GRANTED","minutes":5,"engagement":"WATCH","campaignId":"cmp_xxx"}`
· 404 `{"status":"UNKNOWN_VOUCHER"}` · 409 `{"status":"ALREADY_BURNED_BY_OTHER_GATEWAY"}`
· 429 rate limited (30/min/IP). Connector then provisions the hotspot session
(MikroTik API / RADIUS / vendo bridge).

### SDK embed attributes
| Attribute | Values |
|---|---|
| `data-format` | `inline` (container) \| `interstitial` (full-screen popup with skip; 30 s hard auto-close) — fork default is interstitial |
| `data-gate-seconds` | Mandatory countdown (e.g. `5`) before gated portal buttons unlock; countdown shows 5→1 over the ad. Fork default gates `#insertBtn` (INSERT COIN) for 5 s |
| `data-gate-selector` | CSS selector of the element(s) to gate (default `#insertBtn`) |
| `data-city` / `data-type` / `data-cluster` / `data-gateway` | targeting + device identity |

The gate fires `splashnet:gate-complete` when buttons unlock. Fail-safe: if
the ad never loads, the countdown overlay still runs and unlocks on schedule
— the paid (coin) path is never permanently blocked.

---

## Campaign management — [session]

### GET `/api/v1/campaigns` — [role: VIEWER]
`{ campaigns: Campaign[], advertisers: Advertiser[] }`

### POST `/api/v1/campaigns` — [role: OPERATOR]
Create. Body (creative fields as in fetch response, plus):
`name`, `advertiserId`, `status` (DRAFT|ACTIVE|PAUSED|COMPLETED),
`flightStart`, `flightEnd` (YYYY-MM-DD, Manila), `cityCodes`/`environments`/
`clusterIds` (comma string or array; empty = wildcard/all),
`slots: [{date, startHour, endHour}]` (Manila wall-clock),
`rewardMinutes` (0–60, default 0 — opt-in for watch-to-connect).
- 201 `{campaign}` · 400 validation · **409 overlap** — Pre-Commit Overlap
  Blocker rejected a slot that intersects an ACTIVE campaign on the same
  targeting dimensions: `{error:"overlap", message:"Conflicts with: <names>", conflicts:[ids]}`

### GET|PUT|DELETE `/api/v1/campaigns/{id}` — [role: VIEWER / OPERATOR / OPERATOR]
PUT accepts partial bodies; array-ish fields accept comma strings. Same 409
overlap semantics when activating. Save/pause/retarget purge old Redis cache
keys transactionally.

### POST `/api/v1/schedule/check` — [role: OPERATOR]
Dry-run overlap check for the scheduler UI.
Body: `{cityCodes, environments, clusterIds, slots}` →
`{clear: true|false, conflicts: [{id, name}]}`

## Advertisers — [session]

### GET `/api/v1/advertisers` — [VIEWER] · POST — [OPERATOR]
POST body `{name, contactEmail}` → 201 `{advertiser}`.

## Assets — [session]

### GET `/api/v1/assets` — [VIEWER]
### POST `/api/v1/assets` — [OPERATOR] multipart `file`
Images only (mime-sniffed). Pipeline: transcode → WebP (≤1080px, q80) →
**hard cap 150 KB post-compression** (413 if exceeded; input cap 600 KB).
Stored to S3-compatible store (MinIO local / R2 prod), URL on
`cdn.nxph.site`. Video creatives are loaded to the bucket directly (`mc`)
and referenced via `creative.videoUrl` — the 150 KB cap governs uploaded
images, not bucket-loaded video.

## Areas & advertiser footprint — [session]

**Geo registry** — `GET /api/v1/areas` → `{cities: ["CEB","DVO","MNL"], areas:
[{code, city, name}]}` · `POST` — [OPERATOR] adds `{code: "DVO-PAQUIAO",
city: "DVO", name: "…"}`. Campaign targeting selects from this registry
(cities + optional drill-down areas); area campaigns serve only requests
declaring that area.

**Advertiser footprint** — `PUT /api/v1/advertisers/{id}` accepts
`defaultCities` (comma string/array). The campaign form pre-selects (★) the
advertiser's footprint cities — the advertiser-cohesion default.

## Vendors (network operators) — [session]

A **vendor** is a vendo/network operator registered with SplashNet — company
profile, vendor ID (`VND-XXXX`), and an **API key** (shown exactly once at
creation; authenticates their gateway connector). Vendor IDs attribute ad
serves (`data-vendor` on the SDK embed / `vendor` query param on fetch) and
media uploads (`vendorId` form field) — the cohesion model binding gateways,
creatives, and traffic to the operator that owns them.

### GET `/api/v1/vendors` — [VIEWER] · POST — [OPERATOR]
POST body: `{companyName (required), contactName, contactEmail, contactPhone,
city, clusterIds, gatewayCount, status: PENDING|ACTIVE|SUSPENDED, notes}` →
201 `{vendor}` **including `apiKey` (only time it is ever returned)**.

### PUT|DELETE `/api/v1/vendors/{id}` — [OPERATOR]
Partial updates (profile, status, gateway count). Suspended vendors'
connectors stop authenticating (Module C checks `status='ACTIVE'`).

## Metrics — [session, role: VIEWER]

### GET `/api/v1/metrics?days=7` (1–90)
Campaign performance + vendor rollup:
```json
{
  "totals": { "serves": 68, "fallbackServes": 7, "fillRate": 90,
              "rewardsGranted": 7, "redeemptions": 1 },
  "campaigns": [ { "id": "cmp_…", "name": "…", "status": "ACTIVE",
                   "serves": 20, "engagements": {"watch":2,"click":0},
                   "redemptions": 1 } ],
  "vendors": [ { "vendorId": "VND-3ADCCA", "hits": 4, "monetizedHits": 4 } ]
}
```
Surfaces in the admin Analytics page and is the billable basis for
engagement CPM (watch/click) and vendor revenue share.

## Analytics — [session, role: VIEWER]

### GET `/api/v1/analytics?limit=50` (max 500)
`{stats:{total, fallback}, geo, hits: AdHit[]}` — raw hit stream. Each hit
carries location-trust fields: `sourceIp`, `ipCountry`, `cfColo`
(Cloudflare-reported network truth) alongside the **declared** city from the
embed config. The `geo` block summarizes: `checked` / `inPH` /
`foreignNetworks` / `colos` / `mismatchHits` (declared a PH city but the
request originated abroad — misconfigured or spoofing gateway; Module B
input). Reward ledger available in the `ad_rewards` table (API surface: S1).

**Location trust model:** declared city is operator config (unverified).
Country is confirmed per-request via Cloudflare (`cf-ipcountry`); edge colo
(e.g. `CEB`, `MNL`, `HKG`, `SIN`) is a coarse region cross-check. Vendo/site
location is verified at registration time via IP pinning (Module C).

## Auth

### POST `/api/auth/login` `{email, password}` → sets `splashnet_session`
HttpOnly cookie (7 d, SameSite=Lax, Secure in production). Roles:
ADMIN > OPERATOR > VIEWER.
### POST `/api/auth/logout` · GET `/api/auth/me`
### GET `/api/auth/setup` → `{needsSetup}` · POST — one-shot first-run ADMIN
creation `{email, password≥8}` (409 after first user exists).

## System

### GET `/api/health` — [public]
`{status: healthy|degraded, checks:{postgres, redis}, uptimeSeconds}` —
503 when a dependency is down. Uptime/SLA probe target (GUARD-03).

---

## Conventions

- **Timezone**: every date/hour is Asia/Manila (UTC+8) wall-clock; PH has no
  DST so the fixed offset is exact.
- **Targeting wildcards**: empty array = matches everything.
- **Cache**: write-through Redis; invalidation is transactional on campaign
  save/delete (old keys computed pre-update).
- **Errors** never 5xx the portal path — fail-open returns FALLBACK payloads.
- Admin APIs are same-origin (no CORS); public ad endpoints send
  `Access-Control-Allow-Origin: *` with no preflight requirements.
