#!/usr/bin/env python3
"""Patch the JuanFi template for dockerized simulation:
- replace MikroTik RouterOS variables with static simulation values
- neutralize the router form-submit (no MikroTik behind us) with a simulated
  connect overlay
- inject the SplashNet ad slot (preconnect + container + SDK)
- point the vendo API at the mock container
"""
import re, pathlib

portal = pathlib.Path(__file__).parent / "portal"
login = portal / "login.html"
html = login.read_text()

# 1. RouterOS variable substitution (simulation values)
html = html.replace("$(mac)", "SIM:MA:CR:00:00:01")
html = html.replace("$(ip)", "192.168.88.254")
html = html.replace("$(link-orig)", "https://example.ph")
html = html.replace("$(link-login-only)", "#simulated")
html = html.replace("$(chap-id)", "x")
html = html.replace("$(chap-challenge)", "x")
html = html.replace('loginError = "$(error)"', 'loginError = ""')
# strip conditional marker lines so all branches render as plain HTML
html = re.sub(r"^\s*\$\(if [^)]+\)\s*$", "", html, flags=re.M)
html = re.sub(r"^\s*\$\(endif\)\s*$", "", html, flags=re.M)
html = re.sub(r"^\s*\$\(else\)\s*$", "", html, flags=re.M)

# 2. No router behind us: replace the voucher form-submit with an overlay
html = html.replace(
    "            document.sendin.submit();\n            return false;",
    """            showSimConnected();
            return false;
        function showSimConnected() {
            var el = document.createElement('div');
            el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#16a34a;color:#fff;padding:12px;text-align:center;font-weight:600;font-family:system-ui';
            el.textContent = 'SIMULATION: internet access granted (no MikroTik router behind this portal)';
            document.body.appendChild(el);
            document.querySelector('.status-disconnected').innerHTML =
                'Status: <span style="color:#16a34a">Connected (simulated)</span>';
        }""",
)

# 3. SplashNet ad slot in the left column, right after the IP/MAC info block
ad_snippet = """
				<!-- SplashNet ad slot (injected for simulation) -->
				<link rel="preconnect" href="https://splash.nxph.site" />
				<div id="splashnet-ad" style="margin-top:16px"></div>
				<script>
					// Load the SplashNet SDK with a per-visitor device id, so demo
					// visitors each get their own engagement-reward quota.
					(function () {
						var s = document.createElement("script");
						s.src = "https://splash.nxph.site/sdk/splash.js?v=5";
						s.async = true;
						s.setAttribute("data-city", "DVO");
						s.setAttribute("data-type", "PISO_WIFI");
						s.setAttribute("data-cluster", "JUANFI-SIM");
						s.setAttribute("data-gateway", "SIM-GW-" + Math.random().toString(36).slice(2, 8).toUpperCase());
						document.currentScript.parentNode.appendChild(s);
					})();
				</script>
				<script>
					// Engagement reward: when the user watches/clicks the ad and
					// SplashNet grants free minutes, auto-redeem as voucher + connect.
					document.addEventListener("splashnet:reward", function (e) {
						var v = e.detail.voucher;
						var input = document.getElementById("voucherInput");
						if (input && v) { input.value = v; }
						if (typeof setStorageValue === "function") {
							setStorageValue("activeVoucher", v);
							setStorageValue(v + "validity", String(Date.now() + e.detail.minutes * 60000));
						}
						setTimeout(function () { doLogin(); }, 1200);
					});
				</script>
"""
marker = '<span class="status-disconnected">'
assert marker in html, "injection marker not found"
html = html.replace(marker, ad_snippet + "\n                " + marker, 1)

login.write_text(html)
print("login.html patched")

# 4. Mock vendo address (browser on the host reaches it via localhost:8081)
cfg = portal / "assets" / "js" / "config.js"
c = cfg.read_text()
c = c.replace('var vendorIpAddress = "10.1.0.41";', 'var vendorIpAddress = "localhost:8081";')
c = c.replace("var isMultiVendo = false;", "var isMultiVendo = false;")  # already single-vendo
c = c.replace("var showMemberLogin = true;", "var showMemberLogin = false;")
c = c.replace("var eloadEnable = false;", "var eloadEnable = false;")
cfg.write_text(c)
print("config.js patched -> vendo at localhost:8081")
