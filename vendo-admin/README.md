# Vendo admin overlay — OPTIONAL (read FIRMWARE-POLICY.md first)

**The supported path is the hosted page: https://splash.nxph.site/vendor**
(bookmark / add-to-home-screen). Identical data, and your vendo hardware is
never touched. The fork ships zero binaries and never requires flashing.

This folder exists because the JuanFi vendo admin (NodeMCU SPIFFS) is where
operators already look. If — and only if — an owner accepts SPIFFS re-image
risk themselves, `splashnet.html` is a single static file for `data/admin/`.
Follow the safety protocol in FIRMWARE-POLICY.md: BACKUP config → image from
*their* extracted config (never stock defaults) → RESTORE → verify coin
redemption before leaving the site.
