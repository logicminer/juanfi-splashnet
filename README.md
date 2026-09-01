# juanfi-splashnet — Watch-to-Connect fork of JuanFi

JuanFi (Apache-2.0, © Ivan Alayan & contributors) patched for the
**SplashNet** ad network with **Full Splash Ads**: gated users can watch an
ad and earn free internet minutes — no coins required. Coins remain the paid,
unlimited tier.

Live demo: **https://demo.nxph.site/login.html** (video ad → "Watch 8s and
get 5 min free" → auto-connect).

## What the fork changes

| Area | Change |
|---|---|
| Ad slot | `#splashnet-ad` container + zero-dependency `splash.js` SDK (150 ms fail-open, background retry) injected into `login.html` |
| Watch-to-connect | SDK chip: watch ≥ 8 s or click the CTA → signed single-use reward token redeemed at SplashNet → voucher auto-filled → portal connects |
| HTTPS portals | `core.js` vendo URLs made protocol-relative (mixed-content fix) |
| Config | vendo host configurable (`vendorIpAddress`); per-visitor gateway IDs for reward quotas |
| Sim | Docker stack: nginx portal + mock coin-slot vendo (`sim/`) |

Full spec: [docs/SPLASH-ADS-SPEC.md](docs/SPLASH-ADS-SPEC.md) ·
API: [docs/API.md](docs/API.md) · Glossary: [docs/GLOSSARY.md](docs/GLOSSARY.md)

## Build from upstream

```bash
# 1. obtain the upstream template (tested with v4.3)
git clone --depth 1 https://github.com/ivanalayan15/JuanFi ref/JuanFi

# 2. patch it into the fork
python3 build/build.py ref/JuanFi/mikrotik-template/4.3 dist/portal \
  --city DVO --type PISO_WIFI --vendo https://vendo.example.com

# 3. deploy: upload dist/portal/* into the router's hotspot/ directory
```

The committed `dist/portal` is a prebuilt reference (simulation values).

## Operator checklist (per gateway)

1. **Walled garden first** (before shipping the SDK):
   ```
   /ip hotspot walled-garden add dst-host=splash.nxph.site action=allow
   /ip hotspot walled-garden add dst-host=cdn.nxph.site action=allow
   ```
2. Build with the site's city/type codes.
3. For watch-to-connect on real hardware, run the voucher redemption
   connector (see spec §4 — `POST /api/v1/ad/redeem`).

## Simulation

```bash
cd sim && docker compose up -d
# portal: http://localhost:8888/login.html  ·  mock vendo: :8081
```

Mock vendo implements `/getRates`, `/topUp`, `/checkCoin`, `/cancelTopUp`
with the exact formats JuanFi's `core.js` expects; a coin is auto-accepted
after a few polls.

## License & attribution

Apache-2.0 (inherited from upstream — see [LICENSE](LICENSE) and
[NOTICE](NOTICE) for the full list of modifications). SplashNet-side docs in
`docs/` are © SplashNet.
