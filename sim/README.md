# Simulation stack (portal + vendo with FULL admin parity)

Docker compose: nginx portal (patched JuanFi template) + node vendo.

The vendo mock implements BOTH halves of the real NodeMCU firmware:
- the coin API the portal calls (/topUp, /checkCoin, /getRates, …)
- the vendo admin API the real admin UI calls (admin/api/dashboard,
  getSystemConfig, saveSystemConfig, getRates, saveRates,
  generateVouchers, resetStatistic) — so the genuine upstream admin pages
  (served at the vendo root, like the firmware) fully work: live dashboard,
  editable config persisted to config/*.data, voucher generation.
  splashnet.html (income panel) sits alongside them.

Run: docker compose up -d → portal :8888, vendo :8081 (admin at /system-config.html).
