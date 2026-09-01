/**
 * Mock JuanFi vendo (coin slot) API — simulates the NodeMCU firmware the
 * portal template talks to. Coin flow: poll /checkCoin a few times
 * ("coin.is.reading"), then accept one 5-peso coin, then close the window.
 */
const http = require("http");
const sessions = new Map();

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
