# JuanFi × SplashNet Compatibility (Phase 2 Module C preparation)

Reference: `reference/JuanFi` (github.com/ivanalayan15/JuanFi, template v4.3).
Status: analysis complete — SplashNet SDK is compatible as-is; integration is a
per-operator template edit + MikroTik walled-garden entries. Module C (paid
connector) would automate this.

## Live demo

**https://demo.nxph.site/login.html** — the JuanFi portal (Docker: `sim/`),
serving a real SplashNet video ad, with a simulated coin slot at
`vendo.nxph.site`. Full customer journey works: video ad → INSERT COIN →
voucher issued → CONNECT. Run locally with `cd sim && docker compose up -d`
(portal `:8888`, vendo `:8081`).

## Engagement rewards (watch-to-connect)

Gated users can earn free internet without coins: campaigns set
`rewardMinutes` (e.g. 5) and the SDK shows a reward chip on the ad. Watching
the video ≥ 8 s or clicking the CTA redeems a signed single-use token at
`POST /api/v1/ad/reward`, which returns a voucher code. The portal listens for
the SDK's `splashnet:reward` event, fills the voucher field, and connects —
verified live on the demo (5 minutes granted, auto-connect, ledger row in
`ad_rewards`). Guards: HMAC tokens (10-min TTL), one redemption per token
(Redis NX), max 3 rewards per device per 24 h, fallback creatives never
reward. Note: "follow" verification is approximated by click-through — real
social follows can't be confirmed pre-auth behind a walled garden (Module A/B
scope). In production the voucher is redeemed at the gateway (Module C
connector automates this; the sim wires it to the portal's login).

## How JuanFi's portal works

- The splash/login page is the **MikroTik hotspot HTML template**
  (`mikrotik-template/4.3/login.html`, Bootstrap 4 + jQuery). RouterOS
  substitutes variables like `$(mac)`, `$(ip)`, `$(link-orig)` at page serve.
- The NodeMCU firmware is only the coin acceptor; all pre-auth network gating
  is MikroTik-side.
- Operators customize by editing `login.html` / `assets/js/config.js` and
  re-uploading the folder to the router's `hotspot/` directory. No build step,
  no package manager — deployments are manual and versions in the wild vary
  (v2.4 → 4.3).

## Integration recipe (manual, per operator)

**1. Walled garden FIRST** (before shipping the SDK — #1 failure mode).
MikroTik terminal:

```
/ip hotspot walled-garden add dst-host=splash.nxph.site action=allow
/ip hotspot walled-garden add dst-host=cdn.nxph.site action=allow
```

(JuanFi's own README only allowlists the vendo IP list `JuanfiVendo`;
hostname entries like these are additive and safe.)

**2. Ad container + SDK in `login.html`.** In the left column
(`col-sm-5`, below the IP/MAC info block) add:

```html
<div id="splashnet-ad"></div>
<script
  src="https://splash.nxph.site/sdk/splash.js"
  data-city="DVO"
  data-type="PISO_WIFI"
  data-gateway="$(mac)"
  async
></script>
```

`$(mac)` is RouterOS-substituted with the **client** MAC pre-auth — a stable
device identifier for the analytics stream (feeds Module B anti-fraud).
`status.html` can carry the same snippet for a second impression post-auth.

## Deployment research notes (2026-09-02)

**Router storage.** Piso-wifi workhorses like the MikroTik hAP lite have
16 MB flash and no SD slot; RouterOS v7 runs tight on that and hotspot files
routinely push devices "out of space" (community: remove unused packages,
keep the hotspot directory minimal). Consequence for SplashNet: **creatives
must never live on the router.** Our architecture already complies — the
fork adds ~2 KB of HTML/JS to the template; images (WebP ≤150 KB) and videos
(mp4, bucket-loaded) stream from `cdn.nxph.site` through the walled garden,
transiting only the gateway uplink, never its flash.

**Walled garden matching.** RouterOS matches `dst-host` entries against the
router's DNS cache (not TLS SNI inspection). Clients must therefore use the
hotspot's DNS (default behavior). If a network overrides client DNS, fall
back to `/ip hotspot walled-garden ip add dst-address=<resolved IP>` entries
for `splash.nxph.site` and `cdn.nxph.site` (re-resolve on IP changes —
Cloudflare edge IPs rotate, so prefer fixing client DNS instead).

**Bandwidth.** Pre-auth ad traffic uses the gateway's uplink. Budget ~150 KB
per image impression, ≤1–2 MB per video impression; the interstitial's
30-second cap bounds worst-case exposure per user session.

## Compatibility findings (verified against SplashNet's current SDK/API)

| JuanFi condition | SplashNet behavior | Status |
| --- | --- | --- |
| Portal served over plain `http://<hotspot-ip>` (cross-origin) | `Access-Control-Allow-Origin: *` on `/api/v1/ad/fetch`; GET with query params, no custom headers → **no CORS preflight** | ✅ compatible |
| Pre-auth DNS/TLS through hotspot can be slow or blocked | Native **150 ms fail-open**: ad area hides, login flow untouched | ✅ compatible |
| No ad slot in template | SDK renders into its own `#splashnet-ad` container; fits the Bootstrap grid | ✅ |
| jQuery/Bootstrap present | SDK has zero dependencies, no globals collisions | ✅ |
| Creative assets off-origin | All SplashNet creatives served from `cdn.nxph.site` — walled-garden entries above cover them | ✅ |
| Identifiers available: `$(mac)`, `$(ip)`, `$(link-orig)`, voucher code, vendo ID | `data-gateway` carries any of them into the hit stream; city/type/cluster from per-operator embed config | ✅ |

## Live compatibility test (2026-09-01)

A harness page replicating JuanFi pre-auth conditions — plain HTTP, foreign
origin (`http://<lan-ip>:9999/login.html`, Bootstrap layout, `#splashnet-ad`
container in the left column) — was tested in a real browser against
`splash.nxph.site`:

- **Cross-origin delivery: PASS** — SDK loads via `<script>` (no CORS needed),
  ad fetch is a preflight-free GET with `Access-Control-Allow-Origin: *`.
- **Found & fixed: cold-start impressions.** First fetch (DNS + TLS through
  the hotspot) can exceed the 150 ms fail-open budget, hiding the ad for the
  first visitor. The SDK now fail-opens on time **and retries twice in the
  background (250 ms apart), rendering late if the ad arrives** — the portal
  is never blocked, but the impression is recovered. Verified: ad renders ~0.4 s
  after load despite a blown first budget.
- Operators should add a preconnect hint above the snippet to warm the
  connection during page load:

```html
<link rel="preconnect" href="https://splash.nxph.site" />
```

- Note for QA: browsers cache `/sdk/splash.js`; when updating the SDK, bump
  the query string (`splash.js?v=2`) in portals to force pickup.

## S2S variant (firmware / manager integration)

JuanFi's own vendo calls (`/topUp`, `/checkCoin`, …) are cross-origin jQuery
AJAD to `http://<vendo-ip>` with `Access-Control-Allow-Origin: *` — the same
pattern SplashNet uses. A server-side variant for the JuanFi manager would
call:

```
POST https://splash.nxph.site/api/v1/ad/fetch
{"city":"DVO","type":"PISO_WIFI","gateway":"<client-mac>","cluster":"<site-id>"}
```

## What Module C (₱50,000, optional) would add

- One-click JuanFi template patcher: inject the container + snippet into any
  template version (v2.4–4.3), with layout detection
- Auto-generated walled-garden script per operator (correct city/type codes
- Voucher/session correlation: join ad hits with JuanFi voucher redemptions
  for conversion attribution
- Optional second impression on `status.html` with session metadata
  (`$(session-time-left-secs)`, data volume) as richer targeting signals

Raw hit capture (city, env, gateway/MAC, slot hour) is already recording from
day one, so no data is lost while Module C remains uncommissioned.
