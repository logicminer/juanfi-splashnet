# SplashNet Production Launch Runbook

For the operator of the platform (us). Two supported launch targets:

- **A. This-box launch** — current machine + Cloudflare Tunnel (already
  90% operational; use for pilot phase).
- **B. Cloud launch** — VPS + managed services (use when the pilot
  graduates).

Follow in order; every checkbox is a gate.

---

## Phase 0 — Launch hygiene (DONE 2026-09-02)

- [x] `REWARD_SECRET` rotated to a 256-bit random value (env-only:
      `/etc/splashnet/splashnet.env`). Reward sign→redeem verified after
      rotation.
- [x] All test admin credentials destroyed (`users`/`sessions` wiped).
      **First visit to `splash.nxph.site` now shows the one-shot setup
      screen** — create the real ADMIN there. Never reuse test creds.
- [x] Health monitoring: `splashnet-health.timer` probes `/api/health`
      every 5 min; failures logged (`journalctl -t splashnet-health`) and,
      when `ALERT_WEBHOOK` is set in `/etc/splashnet/health.env`, pushed to
      your chat (Discord/Slack/Telegram incoming-webhook URL). Fill it in:
      `sudo systemctl restart splashnet-health.timer`.
- [x] Full QA green: 33/33 matrix + architecture QA (outage drills).

## Phase 1 — Go-live on this box (pilot-grade production)

1. Visit `https://splash.nxph.site` → setup screen → create the real admin
   (strong password, stored in the password manager).
2. Create real registry entries: Vendor(s) (save the one-time `vnk_` key —
   give it to the operator with the hosted page link
   `https://splash.nxph.site/vendor`), Sites per gateway, Areas if needed.
3. Register real advertisers + campaigns. Rules: reward-eligible campaigns
   **must** carry `budgetPhp` (never NULL in production) and viewer-safe
   creative copy (the QA matrix enforces this).
4. Confirm durability: `systemctl is-active splashnet splashnet-tunnel
   postgresql redis-server minio` → all `active`; `ls /var/backups/splashnet`.
5. Set `ALERT_WEBHOOK` (Phase 0) and verify with a test outage window.
6. Run the pilot: `docs/PILOT-KIT.md`.

## Phase 2 — Cloud launch (when pilot graduates)

1. Provision: VPS (≥1 vCPU/1 GB, Singapore region) or container host;
   managed Postgres 16 + Redis 7 (Neon/Upstash or containers on the VPS);
   Cloudflare R2 bucket + API token.
2. Deploy the container (`Dockerfile`; CI builds it on every push).
   Environment: `DATA_BACKEND=postgres`, `DATABASE_URL`, `REDIS_URL`,
   `REWARD_SECRET` (fresh 256-bit), R2 vars, `COOKIE_INSECURE` unset
   (HTTPS only), `NODE_ENV=production`.
3. `npm run db:migrate` (or CI job) against the managed DB.
4. DNS: move `splash.nxph.site` (and `cdn.nxph.site` → R2 custom domain)
   to the new origin. `demo`/`vendo` hostnames can stay or die.
5. Assets: `mc mirror` the MinIO bucket to R2; update stored URLs
   (`UPDATE assets/campaigns` host swap) or keep path-compatible names.
6. Secrets: never in the repo; host env manager or CI secrets only.
7. Re-run Phase 1 steps 1–5 against the new origin; decommission the box's
   public hostnames only after the new origin has served cleanly for 48 h.

## Rollback

- This box: `systemctl restart splashnet` (crash-restart proven); code
  rollback = previous `deploy.sh` build; DB = nightly dump restore.
- Cloud: tunnel/DNS cutover is reversible by repointing records; keep the
  box warm for 48 h after cutover.

## Standing operational rules

- `deploy.sh` is the only deploy path (build → stage → restart → health).
- Every schema change = new `migrations/NNN_*.sql` (never edit applied ones).
- Any timer/promise shown to a viewer derives from one source of truth.
- Creative fields are public copy — internal jargon fails QA.
- The fork ships zero binaries (FIRMWARE-POLICY.md) — no exceptions.
