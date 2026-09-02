# SplashNet Glossary — Definitive

The single source of truth for terms. If a term is used anywhere (BRD, specs,
API, code, ops) it is defined here. Organized by category so related
assumptions are visible together. When in doubt: **check the ownership column
thinking — "who owns this, where does it live?"**

---

## 1. People & entities (who's who)

**User (subscriber)** — The person on a phone/laptop behind a gateway, gated
pre-authentication. Sees the portal. Has no account anywhere; identified
only by device (MAC/gateway key).

**Network operator / Vendor** — The piso-wifi business owner. Owns the
gateways (routers) and vendos (coin boxes). Registered in SplashNet as a
**vendor** (`VND-XXXX`) with a company profile and API key. Earns a share of
advertiser spend on their gateways. *Not* the advertiser.

**Advertiser** — The brand buying ad inventory. Owns campaigns, creatives,
budgets, and a deployment footprint. Registered separately from vendors.
*Never* owns gateways.

**SplashNet (the platform / us)** — The ad server + admin + CDN. Sells
inventory on behalf of the network, bills advertisers, pays operators.

**Client** (BRD context) — Jean Alistair Clyde S. Chiong, the purchaser of
Phase 1 development. Distinct from "user".

## 2. Surfaces (which screen is which — the classic confusion)

| Surface | Runs on | URL example | Audience |
|---|---|---|---|
| **Portal (captive portal)** | Gateway router (MikroTik hotspot files) | `http://<gateway-ip>/login.html` (demo: `demo.nxph.site`) | End users |
| **JuanFi vendo admin** | Vendo coin box (NodeMCU SPIFFS) | `http://<vendo-ip>/admin/` (sim: `localhost:8081/admin/`) | Operator |
| **SplashNet admin** | SplashNet server | `splash.nxph.site` | Platform + operators with roles |
| **JuanFi Manager** | Upstream commercial SaaS (NOT ours, not deployed here) | — | Upstream product |
| **Advertiser Portal** (`/portal`) | SplashNet server | `splash.nxph.site/portal` | Advertisers (self-service) |

**Rule of thumb:** if it's about coins, MikroTik credentials, or voucher
generation → vendo admin. If it's about campaigns, budgets, sites, vendors,
metrics → SplashNet admin. If it's about getting internet → portal.

## 3. Hardware & deployment units

**Gateway** — The MikroTik router: enforces pre-auth gating, serves the
portal template from flash, applies the walled garden. Identified by MAC/ID
(`data-gateway`, `$(mac)`).

**Vendo** — The NodeMCU/ESP32 coin-acceptor box. Serves its admin from
SPIFFS and the coin API (`/topUp`, `/checkCoin`, `/getRates`, …) the portal
calls. Simulated in our Docker stack (`sim/vendo`, `vendo.nxph.site`).

**Site** — A registered gateway deployment: the `SITE-XXXX` record binding
one portal to its targeting (city/type/cluster/area/vendor), format, and
gate settings. **Server-driven**: editing the site row retargets the portal;
nothing is re-uploaded.

**Walled garden** — The gateway firewall's pre-auth allowlist. Must contain
`splash.nxph.site` + `cdn.nxph.site` (BRD GUARD-02; #1 deployment failure
mode). Matches via the router's DNS cache, not SNI.

**Cluster** — Operator-defined zone of gateways (a purok, a building).
Targeting dimension.

## 4. Geography

**City Code** — Three-letter market (`DVO`, `CEB`, `MNL`). Targeting
dimension; declared by embed/site config; **country** confirmed per-request
via Cloudflare (`cf-ipcountry`), city itself is operator-declared (Module C
adds IP pinning).

**Area** — Registry drill-down under a city (`DVO-AGDAO`): districts. Embeds
declare `data-area`; area campaigns serve only matching requests.

**Deployment footprint** — An advertiser's default cities; pre-selected (★)
in campaign forms.

**Location signals** — Network truth per serve: client IP, country, Cloudflare
edge **colo**. Declared-vs-network mismatches are flagged (`mismatchHits`).

## 5. Ads & inventory

**Campaign** — The bookable unit: advertiser, flights (date range), hourly
**slots**, targeting (city/env/cluster/area), creative, `rewardMinutes`,
`budgetPhp`, `costPerEngagementPhp`. Statuses DRAFT/ACTIVE/PAUSED/COMPLETED.

**Deterministic Time-Slot Model** — Inventory sold as explicit hourly blocks
with guaranteed zero-overlap delivery (vs probabilistic auctions). The BRD's
core concept.

**Slot (hourly slot)** — One bookable hour for a targeting set. **Slot
hour** — the Manila hour (0–23) a serve belongs to.

**Overlap Blocker (pre-commit)** — SQL interval-intersection + row-lock
rejecting ACTIVE bookings colliding on targeting × hour (HTTP 409).

**Creative** — The ad payload: headline, body, CTA, colors, optional
`imageUrl` (WebP ≤150 KB) / `videoUrl` (mp4 from the CDN bucket).

**Fallback creative** — Agency-branded creative for unbooked slots/errors.
Never reward-eligible, never billed.

**Interstitial (popup ad)** — Full-screen ad format with skip and 30 s hard
auto-close. **Coin gate** — mandatory 5→1 countdown interstitial gating a
portal button (default `#insertBtn`). **Inline** — container-embedded format.

**Fail-open** — Architecture rule: any ad-system failure/slowness hides the
ad and never blocks internet access (150 ms client budget; gate countdowns
still unlock on schedule).

**splash.js (SDK)** — Zero-dependency embed script served self-updating from
`/sdk/splash.js` (route handler, no-store). Attributes: `data-site` (see
Sites) or `data-city/type/cluster/area/vendor/gateway/format/gate-*`.
Events: `splashnet:reward`, `splashnet:paid-mode`, `splashnet:gate-complete`,
`splashnet:show`.

**Full Splash Ads** — The product model: watch/click an ad → free minutes;
coins remain the paid tier.

**Watch-to-connect** — The flow: engage with ad → reward voucher → gateway
connects the user.

## 6. Money (the free-minutes economy)

**Budget (`budgetPhp`)** — Advertiser pesos funding a campaign's rewards.
NULL = unlimited. Every engagement debits it; at exhaustion the campaign
stops granting free minutes and portals flip to paid mode.

**Cost per engagement (`costPerEngagementPhp`)** — Pesos the advertiser pays
per completed WATCH/CLICK (default ₱2). Recorded per grant in `ad_rewards`
(`cost_php`).

**Engagement** — Completed ad interaction: `WATCH` (video ≥ 8 s) or `CLICK`
(CTA click-through). Billable, redeemable for reward minutes.

**Reward token** — HMAC-signed, device-bound, single-use (Redis NX), 10-min
TTL token issued with a reward-eligible ad payload.

**Reward voucher** — `SN`+8-hex code returned on redemption; burned
idempotently at the gateway via `/api/v1/ad/redeem`.

**Vendor income** — `Σ cost_php` of engagements on a vendor's gateways
(rewards carry `vendor_id`). Exposed via `/api/v1/vendor/metrics` (API-key
auth) and the vendo admin panel.

**Vendor API key** — `vnk_…` secret issued exactly once at vendor creation;
authenticates the vendo admin surface (and later, gateway connectors).

## 7. Registry entities & cohesion

**Vendor registry** — Company profiles + status (PENDING/ACTIVE/SUSPENDED) +
API keys. **Sites registry** — server-driven portal configs per gateway
deployment. **Areas registry** — the geo dictionary. **Advertisers** — brand
profiles + footprints. Cohesion = every serve, upload, and reward is
attributed to one of these identities.

## 8. Ops & deployment terms

**"Install once, never re-flash"** — The cohesion contract: after initial
install (portal template upload + walled garden + optional vendo admin page
upload), **all changes are server-side** (retargeting, SDK updates, campaign
changes, format/gate changes). Nothing on the gateway or vendo changes.

**Self-updating SDK** — `splash.js` served with revalidate-always caching so
server-side updates reach portals without operator action.

**Connector** — Software bridging SplashNet and a gateway for voucher
redemption → hotspot sessions (on-router script or vendo firmware extension;
Module C commercializes this).

**Hit stream (`ad_hits`)** — Append-only ledger of serves: targeting params,
gateway, vendor attribution, geo signals. **Reward ledger (`ad_rewards`)** —
grants with cost, vendor, burn state.

**RBAC** — SplashNet admin roles: ADMIN > OPERATOR > VIEWER.

**Modules A/B/C** — BRD Phase 2 add-ons: A iOS/Safari tracking bypass (₱45k),
B anti-fraud cleansing (₱40k), C JuanFi connector (₱50k).

## 9. Domains & environments

| Domain | Purpose |
|---|---|
| `splash.nxph.site` | SplashNet app + admin + API + SDK (Cloudflare Tunnel → local stack) |
| `cdn.nxph.site` | Creative assets (MinIO/R2-backed) |
| `demo.nxph.site` | JuanFi fork portal demo (sim portal container) |
| `vendo.nxph.site` | Mock coin-slot API (sim vendo container) |
| `localhost:8888` / `:8081` | Local sim: portal / vendo(+admin) |
| BRD's `splashnet.ph` / `nextph.me` | Placeholders; production runs on `nxph.site` |

**Sim (`sim/`)** — The Docker simulation: real JuanFi template patched by
the fork build, mock vendo with the real upstream admin UI, nginx portal.

**Fork (`juanfi-splashnet`)** — github.com/logicminer/juanfi-splashnet: the
build pipeline (`build/build.py`), reference dist, sim, docs. Apache-2.0
inherited from upstream JuanFi (© Ivan Alayan; modifications in NOTICE).

---

## Common false assumptions — defused

| Assumption | Reality |
|---|---|
| "The admin" (singular) | Three surfaces: vendo admin (coin box), SplashNet admin (server), portal (user). See §2. |
| The SplashNet income page stores data | It's a thin shell; **all** data comes from the SplashNet server via API key. |
| Changing targeting needs a re-upload/re-flash | Since site keys: **never** — it's a server-side row edit. |
| Updating the SDK means re-uploading portals | No — self-updating (no-store route). |
| Advertiser = operator | Advertisers buy inventory; vendors (operators) own gateways and *earn*. |
| The video/image ad lives on the router | Never — creatives stream from `cdn.nxph.site`; router flash only holds the ~2 KB-added template. |
| "Watch 5 min free" costs the operator | No — every granted minute is funded by advertiser budget; when budget ends, portals flip to coin mode. |
| The sim is production | The sim is Docker on the dev machine; production is the `nxph.site` domains. `Connected (simulated)` on the portal marks the difference. |
| JuanFi Manager features are included | JuanFi Manager is upstream's separate commercial SaaS — not ours, not deployed. |
| `vendo.nxph.site` is a real vendo | It's the **mock** coin API for the simulation. |
| The fork ships vendo firmware/binaries | **Never.** Zero binaries, zero firmware mods (FIRMWARE-POLICY.md). The operator income surface is the hosted page `splash.nxph.site/vendor` — zero vendo contact. The SPIFFS overlay file is optional and owner's-risk. |
