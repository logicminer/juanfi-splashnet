# SPLASHNET AD DELIVERY & TRACKING ENGINE · DEMO RUN SHEET

**What to show the client, and what to say about it.**

A tick-through list for the demo team. Section A is the contracted Phase 1 Base Build — the acceptance criteria that unlock the ₱130,000. Section B is what we shipped that the BRD priced as Phase 2 upgrades, included at no charge. Section C is what nobody asked for and we built anyway. Section D is what we will not pretend is finished.

| | | | |
|---|---|---|---|
| **ADMIN CONSOLE** | **ADVERTISER PORTAL** | **OPERATOR CONSOLE** | **CONTRACT** |
| splash.nxph.site | splash.nxph.site/portal | splash.nxph.site/ops | BRD v4.2, signed 2026-08-07 |
| **DEMO PORTAL** | **HOSTED INCOME** | **SDK** | **SHEET DATED** |
| demo.nxph.site | splash.nxph.site/vendor | splash.nxph.site/sdk/splash.js | 2026-09-05 |

---

## A · Contracted scope — the ₱130,000

These are the BRD §3 Phase 1 deliverables. Every one is demonstrable today on production. If the client signs off on this section, both payment milestones are satisfied.

### STAGE 1 · FOUNDATION, RBAC, SCHEDULER & OVERLAP BLOCKER

**Role-based Admin UI with three staff roles and hard tenancy for external users**

> → splash.nxph.site/login. Sign in as admin. Show the 10-item sidebar. Create an OPERATOR user, then sign in as that user to show reduced access. Then sign in as the advertiser and operator to show their own consoles with only their data.

**Advertiser and campaign CRUD with full lifecycle**

> → Campaigns. Create a campaign with city/area targeting, hourly schedule, budget, creative. Submit as DRAFT. Show the overlap blocker rejecting a duplicate slot with HTTP 409. Approve from the admin console. Show it serving live.

**Visual Hourly Calendar Scheduler with live retarget**

> → Scheduler. Show the 24-hour grid with booked slots colored by campaign. Change a site's city from the Sites page, reload the scheduler — the grid follows without any re-upload.

**Pre-Commit Overlap Blocker (SQL intersection)**

> In Campaigns, try to book the same city × environment × hour as an existing ACTIVE campaign. The server returns 409 with the conflicting campaign named. Try a different city — it books cleanly. The blocker is a SQL interval-intersection query with a row lock, not an application check.

**Multi-dimensional targeting: City × Environment × Cluster × Area**

> Create campaigns targeting DVO/PISO_WIFI, CEB/POSTPAID, and an area-specific campaign (DVO-AGDAO). Show all three serving correctly, and show that a request for DVO/POSTPAID gets the fallback (no match).

### STAGE 2 · SDK, AD API & EDGE HARDENING

**splash.js SDK with native 150 ms fail-open timeout**

> → demo.nxph.site. Show the portal loading with a video ad. Block splash.nxph.site in the browser's dev tools network tab, reload — the portal still works (fail-open). Show the embed generator producing a copy-paste snippet.

**/api/v1/ad/fetch serving from Redis write-through cache in <50 ms**

> Show the Server-Timing header (~4 ms application time). Explain: the hot path reads only from Redis, one MGET across 8 candidate keys. The Redis outage drill is documented — when Redis goes down, the API returns fallback creatives in ~14 ms, never hangs.

**Fallback creatives for unbooked slots**

> Fetch with a city that has no campaigns — shows the agency-branded fallback. Explain: fallback is never reward-eligible and never billed.

**Wildcard CORS on public ad endpoints only**

> Show the Access-Control-Allow-Origin: * header on /ad/fetch. Show the admin APIs return no CORS headers. Explain: captive portals run on arbitrary gateway origins, so the ad endpoint must accept cross-origin; admin APIs are same-origin only.

**Asia/Manila UTC+8 normalization with unit-tested time math**

> Show the dashboard clock displaying Manila time. The time module is unit-tested including midnight rollover (16:00 UTC) and slot interval semantics.

**WebP media pipeline with 150 KB hard cap**

> Upload a PNG to Assets — it comes back as WebP, auto-compressed. Upload a large image — HTTP 413 rejection with a clear message. The cap is enforced after compression, not before.

### STAGE 3 · PRODUCTION READINESS & HANDOVER

**Daily automated backups with verified restore**

> Show the backup files in /var/backups/splashnet. Last night's dump is present with all 32 tables. Backups run at 03:00, 7-day retention.

**Health monitoring every 5 minutes**

> Show /api/health returning healthy. Show the health-check log. The webhook alerting is ready — paste a Discord/Slack URL and it pages on failure.

**Deploy pipeline with chunk verification**

> Show deploy.sh running: build → stage → verify chunks → restart → health check. It exits non-zero if any step fails.

**Production runbook and pilot kit**

> Show LAUNCH-RUNBOOK.md (go-live checklist) and PILOT-KIT.md (one real-router pilot: install steps, 9-test script, go/no-go criteria, rollback). These are the handover documents.

---

## B · Priced as Phase 2 upgrades, included at no charge

Each of these is a Phase 2 module or a paid add-on in the BRD. Each is built, deployed, and live today. Show this section after Section A is signed off so the goodwill reads as goodwill.

> **HOW TO TALK ABOUT THIS**
>
> Say "this is included in your build at no additional charge." Do not say "here's what's in the basic tier." The Phase 2 modules (A/B/C) remain available as separate add-ons — what's included here is the infrastructure and self-service tools that make them plug-and-play when commissioned.

**Free-minutes economy: budget-funded ad engagement (₱2 per watch, ₱5 default)**

> Show the advertiser portal's budget field, cost-per-engagement, and reward-minutes settings. Show the billing ledger. Show the revenue-share calculator: ₱100 earned → ₱60 venue / ₱10 maintenance / ₱20 field ops / ₱10 network.

**Coin gate + interstitial (popup) ad formats**

> Show demo.nxph.site with the 5-second countdown gate. Show the watch-ad-for-free-minutes button. Explain: gate completion grants the reward — no second interstitial needed.

**Sites registry with server-driven config ("install once, never re-flash")**

> Show the Sites page with cascading dropdowns (city→area, vendor→cluster). Change a site's city and show the demo portal following within 60 seconds. Explain: operators never re-upload templates for retargeting.

**Operator console (vendor self-service)**

> Sign in as the operator. Show income dashboard, "Running on your portals" campaign visibility, connect-vendo wizard with copyable commands, API key rotation.

**Advertiser portal (Google Ads-equivalent self-service)**

> Sign in as the advertiser. Show the builder: environment toggles, city chips with ★ footprint preselection, area checklist, 24-hour availability grid with reach indicator ("2 gateways online"), creative thumbnail picker, live ad preview, multi-block scheduling, budget + PaySwitch checkout. Show billing with payment integration.

**Demo simulation with real JuanFi template**

> Show demo.nxph.site — a real JuanFi v4.3 template (hash-verified against upstream GitHub) running in Docker with a mock vendo. Show the coin-insert flow working end-to-end.

**Desktop + mobile parity stylesheets**

> Resize the browser window — the sidebar collapses to a horizontal top nav, tables scroll, touch targets grow to 44px minimum. Two separate CSS files linked by media query.

**SMS middleware (vendor-agnostic with failover)**

> Show Integrations page. Explain: priority-ordered provider chain (Semaphore PH → Twilio → custom webhook → dev fallback), circuit breaker (3 failures = 60-second cooldown), durable outbox in Postgres. Paste credentials and it's live.

**PaySwitch payment integration (GCash, Maya, card)**

> Show the Integrations page with PaySwitch credentials form. Show the advertiser billing page with "Pay Now" button and payment-method dropdown. Explain: hosted checkout via PaySwitch, HMAC-verified webhooks, budget credits automatically on payment.

---

## C · What nobody asked for, and we built anyway

**OTP verification and behavioral profiling ("The PLPT Trick")**

> Show the SDK's OTP gate on the demo portal: phone number input → SMS code → verified → free access. Show the profiles table with phone-linked MAC addresses. Explain the data asset: verified PH mobile numbers tied to a physical location and timestamp.

**Persona inference engine**

> Show a profile that visited a car wash — it's automatically tagged VEHICLE_OWNER with demographics (Class A/B/C1) and targeting categories (automotive, insurance, accessories). Six venue-based rules from the client review doc are implemented.

**Revenue share calculator with configurable splits**

> Show GET /api/v1/revenue/VND-3ADCCA?earned=100 returning the full breakdown. Explain: 60/40 default, 10% maintenance, 20% field ops, configurable per vendor.

**Fork on GitHub with zero binaries**

> Show github.com/logicminer/juanfi-splashnet. Explain: Apache 2.0 with NOTICE attributing upstream. Zero firmware binaries shipped. The vendo is never touched — FIRMWARE-POLICY.md documents the brick-risk analysis and the owner's-risk SPIFFS overlay protocol.

**Full proof-of-deliverables pack with 16 screenshots**

> Show PROOF-OF-DELIVERABLES.md on GitHub. Every BRD §3 item mapped to evidence, every surface captured with assert-gated screenshots (verified rendering before capture, no broken pages).

**40-check API matrix as a one-liner regression suite**

> Run: `SPLASHNET_ADMIN_EMAIL=… SPLASHNET_ADMIN_PASSWORD=… python3 scripts/qa-matrix.py`. All 40 pass. Includes self-sufficient fixtures (no dependency on stale test data), viewer-facing creative audit (catches internal jargon leaking to users), and operator-console checks.

---

## D · What we will not pretend is finished

**Module A: iOS/Safari tracking bypass — NOT BUILT**

> Quoted at ₱45,000. Not started. The SDK works on Safari but engagement tracking is less reliable without this module. Say so plainly.

**Module B: Anti-fraud data cleansing — NOT BUILT**

> Quoted at ₱40,000. Not started. The profiling data is captured (visits, personas, revenue ledgers) but no automated cleansing or scoring exists. The `ad_rewards` table has the columns Module B needs (source_ip, token_hash) — it's a read job, not a schema migration.

**Module C: JuanFi portal connector — NOT BUILT**

> Quoted at ₱50,000. The redemption API (`/api/v1/ad/redeem`) is live and idempotent, but nothing provisions real MikroTik hotspot sessions. The pilot kit documents the interim: manual voucher creation or the operator's existing voucher path. This is the biggest gap between "software ready" and "end-to-end product."

**SMS gateway account — THEIR INPUT**

> The middleware is built and tested (dev mode). A real SMS account (Semaphore PH, Twilio, or telco direct) is needed before OTP verification works with real phones. Credentials go in the Integrations page — no code changes required.

**PaySwitch merchant account — THEIR INPUT**

> The payment UI and webhook handler are live. Credentials (X-Product-Id, X-Api-Key, webhook secret) go in the Integrations page. Coordinate with Rex at PaySwitch for the account and the tenant_ref provisioning.

**Real-router pilot — NOT YET RUN**

> The pilot kit is written (9-test on-site script, go/no-go criteria, rollback = delete 3 files). No real MikroTik has run this. Until it does, "connected" on the demo portal is simulated — the banner says "SIMULATION" deliberately.

**Nixon PMS integration — NOT STARTED**

> For hotel venue-type personas (§3.2 of the client review doc). Needs Nixon API access.

---

## E · Before you open the laptop

**Have three role logins ready on separate browser profiles**

> PREP · Switching accounts mid-demo is where multi-role walkthroughs fall apart. Have admin, advertiser, and operator open in three profiles before the client arrives.

**Seed a demo campaign and an in-review campaign the night before**

> PREP · You need a live campaign for the dashboard and scheduler demo, and a DRAFT for the approval-flow demo. Do not build them live.

**Open the demo portal on an actual phone**

> PREP · The portal is mobile-first (coin gate, interstitial, OTP gate). Passing a phone across the table lands better than a narrow browser window.

**Check the health endpoint before the client arrives**

> PREP · `curl splash.nxph.site/api/health` — should return `healthy`. If it doesn't, fix it before the demo, not during.

**Have the QA matrix output ready to show**

> PREP · Run the 40-check matrix before the demo and keep the terminal output visible. "All 40 pass" is a stronger sentence than any screenshot.

**Bring the three asks in writing**

> PREP · SMS gateway credentials; PaySwitch merchant account (via Rex); a pilot router site. Leave the meeting with an owner and a date against each.

**Know the credential rotation plan**

> PREP · The admin, advertiser, and operator accounts all use development passwords. Show that you know they need rotating before real client use — it signals operational maturity.

---

*Tick the boxes as you go and keep this copy with the meeting notes. Section A maps to BRD §3 Phase 1 acceptance criteria; Sections B through E are ours, not contractual. Where this sheet and the executed BRD disagree, the BRD governs.*
