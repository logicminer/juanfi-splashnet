# SplashNet Gateway Onboarding Guide

For network operators connecting Piso Wi-Fi hotspots or postpaid portals to
the SplashNet Ad Delivery network.

**Network domains** (per BRD §7 GUARD-02 — "or CNAME equivalent"):

| Hostname | Purpose |
| --- | --- |
| `splash.nxph.site` | Ad API + admin dashboard + SDK |
| `cdn.nxph.site` | Ad creative images (WebP) |

## 1. Walled-garden configuration

Before deployment, whitelist the SplashNet domains in your gateway firewall /
captive-portal walled garden so they are reachable **before authentication**:

- MikroTik: `IP → Hotspot → Walled Garden IP Hosts` — add `splash.nxph.site`
  and `cdn.nxph.site` (or `*.nxph.site` if your firmware supports wildcards).
- NodeMCU/custom firmware: allow HTTPS (443) to both hostnames in the
  pre-auth DNS/IP allowlist.
- JuanFi (when Phase 2 Module C is commissioned): add both hostnames under
  `Settings → Walled Garden`.

No IP whitelisting is required — both hostnames resolve to Cloudflare's edge.

## 2. Install the ad slot on your portal

Paste this where the ad should render (typically the login/continue screen):

```html
<link rel="preconnect" href="https://splash.nxph.site" />
<div id="splashnet-ad"></div>
<script
  src="https://splash.nxph.site/sdk/splash.js"
  data-city="DVO"
  data-type="PISO_WIFI"
  data-cluster="CLUSTER-01"
  data-gateway="YOUR-GATEWAY-MAC-OR-ID"
  async
></script>
```

| Attribute | Value |
| --- | --- |
| `data-city` | Your city code (DVO, CEB, …) — assigned at onboarding |
| `data-type` | `PISO_WIFI` for prepaid coinslots, `POSTPAID` for residential/commercial |
| `data-cluster` | Optional cluster ID for zone-level campaigns |
| `data-gateway` | Router MAC or ID — used in analytics and rate limiting |

The SDK carries a **150 ms fail-open timeout**: if the ad service is slow or
unreachable, the ad area hides itself and the portal continues — end users are
never blocked from internet access (BRD §2 Fail-Open Architecture).

## 3. Server-to-server variant (optional)

Custom firmware may call the API directly:

```
GET https://splash.nxph.site/api/v1/ad/fetch?city=DVO&type=PISO_WIFI&gateway=MAC
```

or `POST` the same parameters as JSON. The response is the active hourly
payload:

```json
{
  "status": "OK",              // or "FALLBACK" when the slot is unbooked
  "creative": {
    "headline": "…", "body": "…",
    "ctaLabel": "…", "ctaUrl": "…",
    "imageUrl": "https://cdn.nxph.site/splashnet-assets/….webp"
  },
  "slotHour": 14
}
```

## 4. Operational notes

- **Rate limit**: 60 requests/minute per source IP. A portal refreshing the ad
  per user session is far below this; firmware polling loops are not.
- **Timezone**: all hourly slots are Asia/Manila (UTC+8) wall-clock.
- **Responsibility boundary** (BRD §7 GUARD-01): on-site hardware, cabling,
  power, and ISP stability remain the operator's responsibility. SplashNet is
  a web application and API service only.
- **SLA boundary** (GUARD-03): performance acceptance is measured at the API
  edge, excluding client-side ISP latency, congestion, and Wi-Fi dropouts.
- Support: SplashNet administrator — admin@nxph.site
