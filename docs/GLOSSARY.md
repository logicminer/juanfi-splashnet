# SplashNet Glossary

Terms used across the BRD, specs, API, and operations. Alphabetical.

**Ad Slot (hourly slot)** — One bookable hour of inventory for a targeting
dimension set, e.g. `DVO × PISO_WIFI × 2026-09-01 14:00–15:00`. The atomic
unit sold to advertisers.

**AdHit** — One logged serve of `/api/v1/ad/fetch`: city, environment,
cluster, gateway, slot hour, campaign (or fallback). Raw analytics stream;
Module B's future input.

**Advertiser** — Brand buying inventory. Owns campaigns, creatives, and a deployment footprint (default cities) that pre-selects in campaign targeting.

**Area** — Registry drill-down under a city (`DVO-AGDAO`, `CEB-MANDAUE`): districts/zones an advertiser can target beyond city level. Embeds declare their area (`data-area`); area campaigns serve only matching requests. Areas share the cache targeting slot with clusters under the `area:` namespace.

**Deployment footprint** — An advertiser's default set of cities; the campaign form pre-selects them (★) so new campaigns start from the advertiser's usual geography.

**Asia/Manila time (UTC+8)** — The platform's canonical wall-clock for all
scheduling. PH has no DST, so a fixed +8 offset is exact. Server stores UTC;
every comparison normalizes to Manila first.

**Campaign** — A bookable ad unit: flights (date range), hourly slots,
targeting dimensions, creative, optional `rewardMinutes`. Statuses: DRAFT →
ACTIVE → PAUSED/COMPLETED.

**Captive portal** — The pre-auth web page a gateway forces unauthenticated
devices onto (JuanFi's `login.html` is one). The user has no internet here —
only walled-garden hosts are reachable.

**City Code** — Three-letter market code (`DVO`, `CEB`). Targeting dimension.

**Cluster** — Operator-defined zone of gateways (e.g. one purok or building).
Optional third targeting dimension.

**Connector** — Software bridging SplashNet and the gateway: redeems reward
vouchers and provisions hotspot sessions (on-router script or NodeMCU vendo
firmware extension). Commercially Module C.

**Creative** — The ad payload (headline, body, CTA label/URL, colors,
optional `imageUrl`/`videoUrl`). Images: WebP ≤ 150 KB via CDN; video served
from the asset bucket.

**Deterministic Time-Slot Model** — BRD core concept: inventory is sold as
explicit hourly blocks with guaranteed, zero-overlap delivery (versus
probabilistic auctions).

**Edge cache (write-through)** — Redis fronting the ad API. Reads on the hot
path touch only the cache (one MGET over 8 specific→wildcard key candidates);
writes update the source of truth first, then the cache, transactionally.

**Engagement** — A completed ad interaction: `WATCH` (video viewed ≥ 8 s) or
`CLICK` (CTA click-through). Billable, redeemable for reward minutes.

**Fail-open** — Architecture rule: any ad-system failure/slowness (150 ms
budget client-side) hides the ad and lets the portal continue. The user is
never blocked from internet access by ad infrastructure.

**Fallback creative** — Agency-branded creative served for unbooked slots or
errors. Never reward-eligible, never billed.

**Flight** — A campaign's Manila date range (`flightStart`–`flightEnd`).

**Free-minutes economy** — The commercial model tying rewards to advertiser spend: campaigns carry a budget (₱) and cost per engagement (₱). Every watch/click grant debits the budget; when it can't fund another engagement the campaign stops granting free minutes and portals flip to paid (coin) mode. Metrics expose the ledger (spent, remaining, minutes delivered, effective ₱/min) for advertiser invoicing.

**Full Splash Ads** — Product name for the ad-gated access model: watch/click
an ad → free minutes; coins remain the paid tier. Spec: SPLASH-ADS-SPEC.md.

**Gateway** — The router+portal serving a user. Identified by MAC/ID
(`data-gateway` / `$(mac)`). Key for targeting, quotas, and fraud signals.

**Interstitial (popup ad)** — Full-screen ad format (SDK `data-format="interstitial"`): image or video overlay on the portal with an always-present skip button and a 30-second hard auto-close — the user is never trapped. The juanfi-splashnet fork defaults to interstitial on the login page. Creatives stream from the CDN and never occupy router flash storage (hAP-class devices have as little as 16 MB with no SD slot).

**Coin gate (gate interstitial)** — Mandatory countdown interstitial in front of a portal action (default: INSERT COIN): the button is disabled while a 5→1 countdown runs over an image ad, then unlocks (event `splashnet:gate-complete`). Guarantees advertiser exposure before the purchase action. Fail-safe: with no ad loaded the countdown still runs and unlocks — the paid path is never permanently blocked.

**Hit stream** — Append-only `ad_hits` ledger of all serves. Feeds analytics
now, Module B later.

**Location signals / location trust** — How we know where a request really
came from. Declared city/cluster come from the embed config (operator-entered,
unverified). Network truth comes from Cloudflare per request: `cf-connecting-ip`
(client IP), `cf-ipcountry` (country, e.g. `PH`), and the edge **colo** code
from `cf-ray` (e.g. `CEB`, `MNL`, `HKG` — coarse region cross-check). Hits
declaring a PH city but arriving from foreign networks are flagged as
`mismatchHits` — misconfiguration or spoofing, Module B input. Vendo/site
location is pinned at registration (Module C).

**JuanFi** — Open-source piso-wifi system (MikroTik hotspot template +
NodeMCU vendo firmware) by ivanalayan15. Our fork (`juanfi-splashnet`) adds
the SplashNet ad slot and watch-to-connect.

**MikroTik** — RouterOS hardware most piso-wifi operators run; serves the
captive portal template and enforces pre-auth gating.

**Module A / B / C** — BRD Phase 2 add-ons: A) iOS/Safari tracking bypass
(₱45k) · B) anti-fraud data cleansing (₱40k) · C) JuanFi portal connector
(₱50k).

**Network Environment** — `PISO_WIFI` (prepaid, high-frequency) vs
`POSTPAID` (residential/commercial). Targeting dimension.

**NodeMCU / vendo** — ESP8266/ESP32 coin-acceptor box. Exposes the HTTP API
the portal calls (`/topUp`, `/checkCoin`, `/getRates`, …). Simulated in our
Docker stack by `sim/vendo`.

**Overlap Blocker (pre-commit)** — SQL interval-intersection query + row lock
(`FOR UPDATE`) rejecting any ACTIVE booking that collides on targeting
dimensions × hour range on the same Manila date. HTTP 409.

**Piso WiFi** — PH coin-operated prepaid Wi-Fi business model (₱-per-time).

**RBAC roles** — ADMIN (everything + users) > OPERATOR (campaigns, scheduler,
assets) > VIEWER (read-only dashboards).

**Reward token** — HMAC-signed, device-bound, single-use (Redis NX), 10-min
TTL token issued with a reward-eligible ad payload; redeemed at
`/api/v1/ad/reward`.

**Reward voucher** — Code (`SN` + 8 hex) returned on reward redemption;
converted to gateway minutes at `/api/v1/ad/redeem` (connector contract).

**rewardMinutes** — Campaign opt-in field (0–60): free minutes a gated user
earns per engagement. Default 3 engagements/device/24 h.

**S2S (server-to-server)** — Gateway firmware calling the ad API directly
(POST JSON) instead of browser SDK rendering.

**splash.js (SDK)** — Zero-dependency embed script served from
`/sdk/splash.js`. Auto-configured via `data-*` attributes; 150 ms fail-open
timeout with background retries; renders creatives, drives engagement, fires
`splashnet:reward`.

**SplashNet** — This platform: centralized, presentation-agnostic ad delivery
and management for hybrid internet gateways.

**Slot hour** — The Manila hour (0–23) a serve belongs to.

**Vendor** — A network operator (vendo owner) registered with SplashNet: company profile, unique `VND-XXXX` ID, gateway count, clusters, status (PENDING/ACTIVE/SUSPENDED), and an API key for their gateway connector. The cohesion entity — ad serves (`vendor` param), media uploads, and connector calls are all attributed to the vendor that owns them. Distinct from an **advertiser** (the brand buying inventory).

**Vendor API key** — `vnk_…` secret issued once at vendor creation; authenticates the vendor's gateway connector (redeem calls). Never listed afterwards.

**Voucher** — Time-credit code redeemed at the gateway for internet minutes
(coin-purchased in stock JuanFi; ad-earned in the fork).

**Walled garden** — The gateway firewall's pre-auth allowlist. Operators must
whitelist `splash.nxph.site` + `cdn.nxph.site` (BRD GUARD-02; the #1
deployment failure mode).
