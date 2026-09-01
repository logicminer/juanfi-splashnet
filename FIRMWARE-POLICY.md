# Firmware & Binaries Policy — juanfi-splashnet

**The fork ships ZERO binaries and modifies ZERO firmware.** This repository
contains no `.bin` files, no compiled firmware, and no instructions that
require flashing a vendo. This is a hard policy, not a preference.

## Why (the brick analysis)

The vendo is an ESP8266/ESP32. Its admin UI lives in SPIFFS; firmware lives
in flash partitions. Two failure classes:

1. **Hard brick** — firmware images are variant-specific
   (LanBased/WirelessBase × ESP8266/ESP32 × 1M/2M/4M flash, differing
   partition tables). Upstream ships 8+ prebuilt variants for this reason.
   A third party distributing "our build" cannot validate against hardware
   it doesn't hold. Wrong image/address/size = corrupt boot partitions.
2. **Soft brick (business brick)** — SPIFFS re-images from a third-party
   data folder overwrite the operator's live `system.data`/`rates.data`
   (MikroTik credentials, rates). The vendo boots, accepts coins, and
   cannot redeem them. Data loss without visible damage.

The vendo firmware's own update path (`/admin/updateMainBin`) also only
flashes whole firmware bins — there is **no per-file SPIFFS upload API**,
so no API-based way to add files safely.

## What we ship instead

| Artifact | Risk to vendo hardware |
|---|---|
| **Hosted income page** — `https://splash.nxph.site/vendor` (bookmark / add-to-home-screen) | **None. Zero contact with the vendo.** Supported path. |
| Portal template (MikroTik hotspot files) | None — router file upload, no partitions, reversible (delete files). |
| splash.js + site config | None — served over HTTPS from SplashNet. |
| `vendo-admin/splashnet.html` overlay | **None by default.** See below. |

## The vendo-admin overlay: optional, owner's risk, safety protocol

The ONLY vendo-storage artifact we provide is a single HTML file for the
SPIFFS `data/admin/` folder. It is **optional** — the hosted page is the
supported path and shows identical data. If an owner insists on the file
living on their vendo, they must follow this protocol, accepting that
re-imaging SPIFFS is their action, not ours:

1. **BACKUP** — in the vendo admin, System Config → BACKUP (exports
   `system.data`); also export rates. Verify the files open and contain
   *their* values (MikroTik IP, credentials, rates).
2. Re-image SPIFFS from a data folder built from **their extracted config**
   (never from stock defaults), using tooling matching **their** board
   variant and flash size.
3. **RESTORE** — System Config → RESTORE with the backup from step 1;
   verify coins still redeem on the portal before leaving the site.
4. If anything looks wrong: re-flash the **upstream release image for their
   exact variant** from ivanalayan15/JuanFi and RESTORE again.

## Rules for contributors

- Never commit `.bin`, `.elf`, `.img`, or compiled artifacts. CI should
  reject them.
- Never instruct operators to flash anything we provide — we provide
  nothing flashable.
- Upstream firmware bugs are upstream's domain; report them to
  ivanalayan15/JuanFi, don't fork the firmware.
- Changes to this policy require updating BRICK-RISK analysis above.

## Warranty boundary (aligns with BRD GUARD-01)

SplashNet is a web application and API service. On-site hardware — routers,
vendos, cabling, power — is the operator's responsibility, and the operator
alone performs any action on their hardware.
