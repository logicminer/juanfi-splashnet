/**
 * Mock JuanFi vendo (coin slot) API — simulates the NodeMCU firmware the
 * portal template talks to. Coin flow: poll /checkCoin a few times
 * ("coin.is.reading"), then accept one 5-peso coin, then close the window.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const sessions = new Map();

const ADMIN_DIR = path.join(__dirname, "admin");
const CFG_DIR = path.join(ADMIN_DIR, "config");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".data": "text/plain" };

// ---- JuanFi vendo admin API parity (mirrors the NodeMCU firmware) ----

const bootTime = Date.now();
const stats = { lifeCoins: 0, sessionCoins: 0, customers: 0 };

function readCfg(name, fallback) {
  try {
    return fs.readFileSync(path.join(CFG_DIR, name), "utf8").trim();
  } catch {
    return fallback;
  }
}
function writeCfg(name, data) {
  fs.mkdirSync(CFG_DIR, { recursive: true });
  fs.writeFileSync(path.join(CFG_DIR, name), data);
}
function cfgField(n) {
  return readCfg("system.data", "").split("|")[n] ?? "";
}

function adminApi(req, res, pathname, query, body) {
  const text = (s) => {
    res.writeHead(200, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
    res.end(String(s));
  };

  if (pathname === "/admin/api/dashboard") {
    // upTimeMs|lifeCoins|sessionCoins|customers|internet|mikrotik|mac|ip|hw|version
    stats.sessionCoins += 0;
    text(
      [Date.now() - bootTime, stats.lifeCoins, stats.sessionCoins, stats.customers, 1, 1,
       "SIM:VE:ND:00:00:01", "192.168.88.50", "ESP32", "2.3-sim"].join("|")
    );
    return true;
  }
  if (pathname === "/admin/api/getSystemConfig") {
    text(readCfg("system.data", "JuanFi Vendo (sim)|admin||10.0.10.1|pisonet|abc123|30|admin|admin"));
    return true;
  }
  if (pathname === "/admin/api/saveSystemConfig") {
    const m = decodeURIComponent((body.match(/data=([^&]*)/) || [])[1] || "");
    if (m) {
      writeCfg("system.data", m);
      console.log("[vendo-admin] system config saved");
    }
    text("1");
    return true;
  }
  if (pathname === "/admin/api/getRates") {
    text(readCfg("rates.data", "1 peso / 10min#1#10#20##|5 peso / 1hour#5#60#120##"));
    return true;
  }
  if (pathname === "/admin/api/saveRates") {
    const m = decodeURIComponent((body.match(/data=([^&]*)/) || [])[1] || "");
    if (m) {
      writeCfg("rates.data", m);
      console.log("[vendo-admin] rates saved");
    }
    text("1");
    return true;
  }
  if (pathname === "/admin/api/generateVouchers") {
    const p = new URLSearchParams(body);
    const amt = p.get("amt") || "5";
    const pfx = p.get("pfx") || "SIM";
    const qty = Math.min(parseInt(p.get("qty") || "5", 10) || 5, 100);
    // validity from the matching rate row (minutes), else 60
    let minutes = 60;
    for (const row of readCfg("rates.data", "").split("|")) {
      const cols = row.split("#");
      if (cols[1] === amt) { minutes = parseInt(cols[2], 10) || 60; break; }
    }
    const codes = Array.from({ length: qty }, () => pfx + Math.random().toString(36).slice(2, 8).toUpperCase());
    // response: vendoName|amount|validitySeconds|code1#code2#...
    text([cfgField(0) || "JuanFi Vendo (sim)", amt, minutes * 60, codes.join("#")].join("|"));
    return true;
  }
  if (pathname === "/admin/api/resetStatistic") {
    stats.lifeCoins = 0;
    stats.sessionCoins = 0;
    stats.customers = 0;
    text("1");
    return true;
  }
  if (pathname === "/admin/api/logout" || pathname === "/admin/viewGeneratedVouchers") {
    // the print page lives at voucher-generate.html
    if (pathname === "/admin/viewGeneratedVouchers") return false; // fall through to static
    text("1");
    return true;
  }
  return false;
}

// Serve the JuanFi vendo admin UI (as the NodeMCU SPIFFS would).
function serveAdmin(req, res, pathname) {
  let rel = pathname.replace(/^\/admin\/?/, "");
  if (!rel) rel = "index.html";
  if (rel === "viewGeneratedVouchers" || rel.startsWith("viewGeneratedVouchers?")) rel = "voucher-generate.html";
  const file = path.join(ADMIN_DIR, rel);
  if (!file.startsWith(ADMIN_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("not found");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

const RATES = "5#1#1#60#|10#1#1#1440#|20#1#1#4320#"; // rate#x#x#validityMin#dataMB

function body(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => resolve(Object.fromEntries(new URLSearchParams(d))));
  });
}

function json(res, obj) {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(obj));
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (req.method === "OPTIONS") return json(res, {});

    // JuanFi vendo admin: API parity first, then static files.
    if (url.pathname.startsWith("/admin/api/")) {
      const raw = await new Promise((resolve) => {
        let d = "";
        req.on("data", (c) => (d += c));
        req.on("end", () => resolve(d));
      });
      if (!adminApi(req, res, url.pathname, url.searchParams, raw)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not found");
      }
      return;
    }
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      return serveAdmin(req, res, url.pathname);
    }
    // Real firmware serves admin pages at the vendo root (e.g.
    // /system-config.html) — their relative "admin/api/..." calls depend on it.
    if (req.method === "GET" && !["/", "/status"].includes(url.pathname) && !url.pathname.startsWith("/api/")) {
      const rel = url.pathname.replace(/^\//, "");
      const candidate = path.join(ADMIN_DIR, rel);
      if (rel && candidate.startsWith(ADMIN_DIR) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        res.writeHead(200, { "Content-Type": MIME[path.extname(candidate)] || "application/octet-stream" });
        return fs.createReadStream(candidate).pipe(res);
      }
    }

    if (url.pathname === "/getRates") {
      res.writeHead(200, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
      return res.end(RATES);
    }

    if (url.pathname === "/topUp" && req.method === "POST") {
      const b = await body(req);
      const voucher = "SIM" + Math.random().toString(36).slice(2, 8).toUpperCase();
      sessions.set(voucher, { polls: 0, coins: 0, opened: Date.now() });
      console.log(`[vendo] topUp mac=${b.mac} -> voucher ${voucher}`);
      return json(res, { status: "true", voucher });
    }

    if (url.pathname === "/checkCoin" && req.method === "POST") {
      const b = await body(req);
      const s = sessions.get(b.voucher);
      if (!s) return json(res, { status: "false", errorCode: "voucher.not.found" });
      s.polls++;
      if (s.polls <= 3) return json(res, { status: "false", errorCode: "coin.is.reading" });
      if (s.polls === 4) {
        s.coins = 1; // one 5-peso coin accepted
        stats.lifeCoins += 5; stats.sessionCoins += 5; stats.customers += 1;
        console.log(`[vendo] coin accepted for ${b.voucher}`);
        return json(res, {
          status: "true", totalCoin: "5", newCoin: "5", timeAdded: "3600",
          validity: "3600", data: "unlimited", remainTime: "8000", waitTime: "8000",
        });
      }
      // window closing countdown
      const elapsed = Date.now() - s.opened;
      const remain = Math.max(0, 9000 + s.polls * 1000 - elapsed);
      if (remain <= 0) {
        return json(res, {
          status: "false", errorCode: "coin.not.inserted", totalCoin: "5",
          timeAdded: "3600", validity: "3600", remainTime: "0", waitTime: "9000",
        });
      }
      return json(res, {
        status: "false", errorCode: "coin.not.inserted", totalCoin: "5",
        timeAdded: "3600", validity: "3600", remainTime: String(remain), waitTime: "9000",
      });
    }

    if (url.pathname === "/cancelTopUp") return json(res, { status: "true" });
    if (url.pathname === "/useVoucher" || url.pathname === "/convertVoucher")
      return json(res, { status: "true", timeAdded: "3600" });

    res.writeHead(404, { "Access-Control-Allow-Origin": "*" });
    res.end("not found");
  })
  .listen(80, () => console.log("[vendo] mock coin slot ready on :80"));
