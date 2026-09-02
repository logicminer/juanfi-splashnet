# SplashNet × JuanFi Pilot Kit — One Real Router

Objective: validate the whole product on **one real MikroTik site** with one
real vendo, before fleet rollout. Duration: 1–2 weeks. Success criteria at
the end; rollback is trivial (delete 3 files).

## 0. Prerequisites

- One MikroTik hotspot router (RouterOS v6.45+ recommended; DNS served by
  the router — the default), running stock JuanFi v4.3 with its vendo.
- The operator's SplashNet onboarding done: **Vendor** registered (give
  them the one-time `vnk_` key + `https://splash.nxph.site/vendor`
  bookmark), **Site** registered for this gateway (`SITE-XXXX`) with the
  site's real city/type/cluster, gate seconds per operator preference.
- 30 minutes of quiet time at the site.

## 1. Install (the only hardware touch — router only)

```
# 1. Walled garden FIRST (before shipping the portal):
/ip hotspot walled-garden add dst-host=splash.nxph.site action=allow
/ip hotspot walled-garden add dst-host=cdn.nxph.site action=allow

# 2. Build the fork with the site key:
python3 build/build.py <juanfi-4.3-template> dist/portal \
    --site SITE-XXXX --gate-seconds 5

# 3. Upload dist/portal/* into the router's hotspot/ folder (Winbox FTP).
#    (data-site means everything else is server-driven from here on.)
```

The vendo is **not touched at all** (FIRMWARE-POLICY.md).

## 2. Pilot test script (run on-site, phone in hand)

Connect an unauthenticated phone; expect the portal with the interstitial.

| # | Test | Pass condition |
|---|---|---|
| P1 | Portal loads pre-auth, ad renders | Interstitial appears within ~2 s; creative visible |
| P2 | Coin gate | Countdown 5→1 over the ad; INSERT COIN unlocks at zero; **free minutes voucher applied → user online** (SDK v11) |
| P3 | WATCH AD button | On-demand interstitial plays; 8 s watch (or full gate) → voucher → online |
| P4 | Coin path (regression) | INSERT COIN → vendo flow → voucher → online exactly as stock JuanFi |
| P5 | Paid-mode flip | Exhaust the device's daily cap (3 rewards) → chip says limit reached → coin path still works |
| P6 | Fail-open | Block splash.nxph.site in walled garden temporarily → portal still loads, coin path works, no hang |
| P7 | Server retarget | Change the Site's cluster/city/gate in SplashNet admin → portal follows within a minute (reload), no re-upload |
| P8 | Vendor income | Operator opens splash.nxph.site/vendor → engagements/₱ match reality |
| P9 | Real-session caveat | Note: until Module C, P2/P3 free time is **voucher-based** — on real hardware the portal login must accept it via the operator's voucher path, or run the interim connector below |

**P9 interim (no Module C):** create the earned minutes as a MikroTik
voucher manually/by script for the pilot (`/ip hotspot user add ...
limit-uptime=5m`), or accept voucher-at-counter redemption for the pilot
period. Module C automates this (commercial).

## 3. Success criteria (go/no-go for fleet)

- All P1–P8 pass on ≥ 3 different phones (Android + iPhone; iPhone note:
  Safari quirks are Module A scope).
- Zero coin-revenue regressions across the pilot window (compare coin
  counts in the vendo dashboard vs. the previous week).
- Ad serves ≥ 90% of portal loads (fallback < 10%) — from SplashNet
  metrics for this Site.
- Operator can self-serve: retarget the site, read their income page.

## 4. Rollback (complete)

Delete `login.html`, `assets/js/core.js`, `assets/js/config.js` from the
router's hotspot folder and re-upload the stock JuanFi 4.3 files. Remove
the two walled-garden lines. The gateway is byte-identical to stock; the
Site record in SplashNet can be paused (`status: PAUSED`). Nothing else
was ever installed.

## 5. Fleet rollout (after go)

Per new site: register Site + (optionally) reuse Vendor → walled garden ×2
→ upload fork build with `--site`. That's the entire per-site cost.
