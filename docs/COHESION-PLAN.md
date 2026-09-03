# SplashNet Cohesion Plan — the Complete Map

The single document that answers: **who is who, what is what, where money
and data flow, and what remains to make the whole system one organism.**

---

## 1. The entity graph (who owns what)

```
ADVERTISER (brand)  ──buys──▶  CAMPAIGN  ──funds──▶  FREE MINUTES (budget)
      │  (footprint cities)         │ slots/targeting/creative
      ▼                             ▼ serves on
 VENDOR (operator)  ──owns──▶  SITE/GATEWAY  ──shows──▶  PORTAL ──▶ USER
      │  (api key, income)          │ server-driven config
      ▼                             ▼ engagement
  VENDO (coin box,           REWARD TOKEN ──▶ VOUCHER ──▶ SESSION
   NEVER touched by us)            │ cost debits campaign budget
                                   ▼
                          ad_rewards ledger (vendor credit)
```

Every row in every table carries its owner: hits → vendor+gateway+geo,
rewards → campaign+vendor+cost, assets → uploader, sites → vendor,
campaigns → advertiser. **Cohesion = no orphan data.**

## 2. The surface map (who sees what)

| Surface | Who | Can do |
|---|---|---|
| Portal (router) | End user | watch ad → free minutes; coins |
| Vendo admin (coin box) | Operator | JuanFi settings (upstream); SplashNet income tile (optional overlay) |
| Hosted income page (`/vendor`) | Operator | earnings quick-view (API key; zero hardware contact) |
| **Operator Console** (`/operator`) | Vendor login | income dashboard, self-serve site registration (PENDING→admin activates), connect-vendo wizard with copyable commands, connection test, API-key rotation |
| **Advertiser Portal** (`/portal`) | Advertiser | campaigns (build/pause/top-up), creatives, availability grid, charts, billing, account |
| **Admin Console** (`/`) | Staff (ADMIN/OPERATOR/VIEWER) | everything + approval gate + users + registries + metrics |
| Demo sim (`demo`/`vendo.nxph.site`) | Us | full JuanFi parity demo — never production |

Role separation is enforced at the API boundary: ADVERTISER sessions are
403 on every admin endpoint; portal endpoints derive tenancy from the
session only.

## 3. The money flow (one ledger, three views)

```
Advertiser budget (₱, per campaign)
   ── per completed engagement (WATCH 8s+ / CLICK / gate completion)
   ├── debit: campaign.budgetPhp → stops free minutes at exhaustion
   ├── credit: ad_rewards.cost_php + vendor_id  → operator income view
   └── record: metrics.commercial (spent/remaining/₱-per-minute) → billing view
```

All three views (admin metrics, portal billing, vendor income page) read
the same `ad_rewards` rows — one truth, no reconciliation.

## 4. The event/data spine

`ad_hits` (every serve: targeting, vendor, geo signals) and `ad_rewards`
(every engagement: cost, vendor, burn state) are the system's spine. Every
surface is a projection of these two append-only ledgers plus the
registries (advertisers, vendors, sites, areas). Module B (anti-fraud)
later cleanses the spine; nothing downstream needs to change.

## 5. Operational cohesion ("install once")

| Layer | Touched at install | Changed at runtime |
|---|---|---|
| Router portal | 3 files + walled garden | never (site keys, SDK self-update) |
| Vendo | nothing (or 5 KB optional) | never |
| Server | — | everything (deploy) |

## 6. What remains (the honest roadmap)

| # | Gap | Owner | Blocks |
|---|---|---|---|
| 1 | **Real-router pilot** (PILOT-KIT) | ops | everything hardware |
| 2 | **Module C connector** — voucher → hotspot session automation | commercial (₱50k) | true watch-to-connect on hardware; interim documented |
| 3 | **Module A** — iOS/Safari tracking bypass | commercial (₱45k) | iPhone engagement accuracy |
| 4 | **Module B** — anti-fraud cleansing of the spine | commercial (₱40k) | scale (fine at pilot) |
| 5 | Invoicing: generated invoices/payment integration on portal billing | us, later | advertiser self-serve payments |
| 6 | Notifications: review-approved/ budget-exhausted emails to advertisers; site-activated alerts + payout reports to operators | us, later | polish |
| 7 | Cloud migration (LAUNCH-RUNBOOK Phase 2) | us | scale beyond one box |
| 8 | Advertiser schedule *booking* (reserve slots at build time vs. current review flow) | us, later | higher self-serve autonomy |

## 6.5 The visibility links (verified live 2026-09-03)

Cohesion is bidirectional — both sides can see the other through the
platform, without ever seeing each other's private data:

| Direction | Signal | Surface |
|---|---|---|
| Advertiser → supply | "reach: N active gateways" per city/env on the availability grid (0-gateway cities warned explicitly) | Builder |
| Operator → demand | "Running on your portals": campaign + advertiser + slots for ACTIVE campaigns matching their sites' city/env | Operator Console |
| Operator → money | engagements/₱ credited in real time from the same ad_rewards rows | Operator Console + hosted page |

The full trace is testable as one chain: advertiser books → site serves
(with vendor attribution) → user engages → voucher granted → operator
income credited → campaign visible in the operator's console.

## 7. Cohesion invariants (regression-test these)

1. No orphan rows: every hit/reward/asset/site resolves to a registry entity.
2. Tenancy: advertiser sessions never read cross-advertiser data (QA matrix).
3. One money truth: portal billing == vendor income slices == admin metrics.
4. Viewer-facing copy never contains internal jargon (QA creative audit).
5. Install-once: no routine change requires touching gateway or vendo.
6. Fail-open: ad infra can degrade monetization, never access.
7. Timers shown to users are promises (single source of truth for durations).
