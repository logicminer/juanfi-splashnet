# Vendo admin overlay — SplashNet inside JuanFi's own admin

`splashnet.html` drops into the NodeMCU vendo's SPIFFS `data/admin/`
folder (one-time upload alongside `system-config.html` /
`voucher-generate.html`). After that it is fully self-updating: all data is
fetched live from the SplashNet server (`/api/v1/vendor/metrics`), so the
page never needs to be re-uploaded.

What the operator sees on their coin box at `http://<vendo-ip>/admin/splashnet.html`:

- Connection status + vendor identity (VND-XXXX)
- **Advertiser-funded income** (₱ earned from watch-to-connect engagements)
- Engagements, free minutes delivered, ad serves, monetized %
- Their registered sites (retargetable from the SplashNet admin — no re-flash)

Setup: paste the vendor API key once (issued at vendor registration; shown
exactly once). It is stored in the browser's localStorage.

Note: JuanFi's stock admin has no index page (operators navigate directly to
each file). Optionally add a link to `splashnet.html` in
`system-config.html`, or ship `index.html` from this folder.
