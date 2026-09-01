# Full Splash Ads — Product & Fork Specification

Status: **specification** (simulation-proven at https://demo.nxph.site)
Parent: SplashNet BRD v4.2 · supersedes nothing in Phase 1 scope; this is the
ad-gated access model built *on top of* the Phase 1 core.

---

## 1. Concept

**Watch this ad for 5 free minutes.** On captive portals, the user is gated
(no internet until payment). Full Splash Ads makes advertiser inventory a
second currency alongside coins:

- **Free tier** — watch the ad video ≥ 8 s (or click through) → 5 minutes of
  internet. Capped at 3 engagements/day per device (15 free minutes).
- **Paid tier** — coin slot, unchanged. Ad engagement never competes with
  coin revenue beyond the operator's configured cap.

Everyone wins: the user gets zero-coin connectivity, the advertiser gets
guaranteed attention (billable), the operator gets a free tier that pays for
itself and converts to coins when the cap is reached.

## 2. Access lifecycle (state machine)

```
 [GATED] --serve ad--> [ENGAGING] --watch/click--> [REWARDED]
    ^                                                   |
    |                                              (redeem voucher
    |                                               at gateway)
    |                                                   v
    +-- daily cap reached --+                   [ONLINE (5 min)]
    |                       |                          |
    |                  [COIN UI ONLY] <-- expiry, cap reached --+
    |                       |
    +-- cap remaining -------+  (next visit / expiry re-serves ad)
```

Rules:
1. Ad serving, engagement, and reward redemption must **never block or slow** the paid path. The coin gate's countdown **is** a completed watch: reward-eligible ads grant free minutes exactly when the gate hits zero (chip text states the gate duration, not the generic 8 s).
   the paid path (fail-open architecture, BRD §2, extends here).
2. On session expiry with daily cap remaining → re-serve an ad automatically.
3. On expiry with cap reached → coin UI only, with the cap reset at midnight
   Asia/Manila.
4. Free minutes never stack beyond the cap; coin minutes are unlimited and
   additive.

## 3. The JuanFi fork ("juanfi-splashnet")

A maintained fork of `ivanalayan15/JuanFi` (template v4.3 baseline, in
`reference/JuanFi`). The fork is **a build product**: the upstream template
plus `sim/patch-portal.py` (growing into `fork/build.py`), never hand-edited
per deployment. Distribution: zip per operator + one MikroTik terminal block.

### 3.1 Fork changes vs upstream (current, proven in sim)

| # | File | Change | Why |
|---|---|---|---|
| F1 | `login.html` | Inject `<link rel="preconnect">`, `#splashnet-ad` container, SDK loader with per-visitor gateway ID, `splashnet:reward` listener that auto-fills the voucher and calls `doLogin()` | Ad slot + watch-to-connect |
| F2 | `assets/js/core.js` | `"http://" + vendorIpAddress` → `location.protocol + "//" + vendorIpAddress` (8 call sites) | HTTPS portals get mixed-content blocked otherwise |
| F3 | `assets/js/config.js` | `vendorIpAddress` → deployment's vendo host; member login/e-load toggles off by default | cloud-friendly defaults |
| F4 | `login.html` | `doLogin()` router form-submit → connect bridge (`connectBridge(voucher)`) | lets reward vouchers connect without MikroTik CHAP in sim; in production this is where the connector hooks in |
| F5 | nginx `/status` | must return the magic string `IAMNOTLOGINSTRINGPLEASEDONTREMOVE` | JuanFi's core.js gates the whole coin flow on this probe (discovered in simulation) |

### 3.2 Fork changes (next iteration, this spec)

| # | Change | Purpose |
|---|---|---|
| F6 | Primary UI: "WATCH AD → 5 MIN FREE" button above INSERT COIN, with daily-cap counter ("2 free sessions left today") | free tier is the product, not an add-on |
| F7 | Reward voucher redemption via gateway connector (`POST /api/v1/ad/redeem`) instead of direct `doLogin` | real sessions on real routers |
| F8 | Session countdown banner (minutes left, "watch another ad" when cap remains, "insert coin" when capped) | lifecycle completeness |
| F9 | `status.html`: post-auth re-serve on expiry (second impression, countdown, re-engage button) | retention loop |
| F10 | Ad block detection: if SDK fail-opens 3× in a row, log `ad.blocked` and fall back to coin-only UI silently | graceful degradation on non-whitelisted gateways |

### 3.3 Deployment per operator (unchanged contract, see GATEWAY-ONBOARDING)

1. MikroTik walled garden: `splash.nxph.site`, `cdn.nxph.site` (+#1 failure mode)
2. Upload fork zip → router `hotspot/` dir
3. Set city/type/cluster in the fork's `config.js` (build-time or in-portal)

## 4. Gateway redemption contract (production)

The sim wires reward vouchers straight into the portal's login. On real
MikroTik hardware, something must convert a SplashNet voucher into a hotspot
session. That something is **the connector** (fork-bundled script or Module C):

```
SDK (watch/click) → POST /api/v1/ad/reward  → voucher SN1A2B3C4
connector on gateway → POST /api/v1/ad/redeem {voucher, mac}
                      → {minutes: 5} → create hotspot session (MikroTik API /
                        RADIUS / JuanFi vendo bridge)
```

`/api/v1/ad/redeem` is idempotent (voucher burns on first redeem), keyed to
the requesting gateway, and returns the minutes to provision. Spec in
[API.md](./API.md#post-apiv1adredeem).

Two supported connector shapes:
- **On-router** — small script/scheduler on RouterOS polling a local queue, or
- **On-vendo** — NodeMCU firmware extension exposing `/grantVoucher` (fits
  JuanFi's existing vendo API surface; the portal already knows how to call it)

## 5. Monetization model

- Reward-eligible campaigns carry `rewardMinutes` and bill at an
  engagement CPM (watched seconds / verified clicks from `ad_rewards` ledger).
- Fallback creatives are never reward-eligible (unpaid inventory).
- Operator economics: free-tier minutes are ad-funded; cap (default 3/day)
  is the dial between user goodwill and coin cannibalization. Configurable
  per deployment via campaign `rewardMinutes` + server quota constant.

## 6. Fraud posture (Module B territory, day-one signals)

Client-side engagement is inherently spoofable. Day-one mitigations shipped:
signed single-use tokens (10-min TTL), device quota (3/day), per-IP rate
limits, full ledger (`ad_rewards`) with device/city/engagement/timestamp.
Module B adds: watch-pattern analysis, device fingerprinting, click-velocity
scoring, retroactive ledger cleansing.

## 7. Rollout plan

| Phase | Scope | Status |
|---|---|---|
| S0 | Core rewards API + SDK v5 + sim proof | **done** (2026-09-01) |
| S1 | Fork F6–F8 (primary UI, connector redemption, countdown) | next |
| S2 | On-vendo connector firmware extension (Module C scope) | quoted separately |
| S3 | Post-auth re-serve + re-engage loop (F9) | after S1 |
| S4 | Fraud hardening hand-off to Module B | commercial |
