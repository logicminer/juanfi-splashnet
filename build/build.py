#!/usr/bin/env python3
"""juanfi-splashnet build: patch an upstream JuanFi hotspot template into the
SplashNet watch-to-connect fork.

Usage:
  python3 build/build.py <upstream-template-dir> <output-dir> \
      --city DVO --type PISO_WIFI [--cluster ID] \
      [--vendo vendo.example.com] [--sdk-base https://splash.nxph.site]

Reproducible: never hand-edit deployments. Re-run against newer upstream
templates and resolve any assertion failures as upstream drift.
"""
import argparse, pathlib, re, shutil, sys


def patch_login(html: str, city: str, env_type: str, cluster: str, sdk_base: str, fmt: str = "interstitial", gate_seconds: int = 5, gate_selector: str = "#insertBtn") -> str:
    # RouterOS variables -> simulation-safe values. In production RouterOS
    # substitutes these itself; the SDK loader below assigns per-visitor
    # gateway ids in the sim.
    html = html.replace("$(mac)", "SIM:MA:CR:00:00:01")
    html = html.replace("$(ip)", "192.168.88.254")
    html = html.replace("$(link-orig)", "https://example.ph")
    html = html.replace("$(link-login-only)", "#simulated")
    html = html.replace("$(chap-id)", "x")
    html = html.replace("$(chap-challenge)", "x")
    html = html.replace('loginError = "$(error)"', 'loginError = ""')
    html = re.sub(r"^\s*\$\(if [^)]+\)\s*$", "", html, flags=re.M)
    html = re.sub(r"^\s*\$\(endif\)\s*$", "", html, flags=re.M)
    html = re.sub(r"^\s*\$\(else\)\s*$", "", html, flags=re.M)

    # No router behind the sim: bridge the voucher form-submit.
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

    cluster_attr = f'\n\t\t\t\t\t\ts.setAttribute("data-cluster", "{cluster}");' if cluster else ""
    snippet = f"""
				<!-- SplashNet ad slot (juanfi-splashnet build) -->
				<link rel="preconnect" href="{sdk_base}" />
				<div id="splashnet-ad" style="margin-top:16px"></div>
				<script>
					(function () {{
						var s = document.createElement("script");
						s.src = "{sdk_base}/sdk/splash.js?v=7";
						s.async = true;
						s.setAttribute("data-city", "{city}");
						s.setAttribute("data-type", "{env_type}");{cluster_attr}
						s.setAttribute("data-gateway", "SIM-GW-" + Math.random().toString(36).slice(2, 8).toUpperCase());						s.setAttribute("data-format", "{fmt}");
						s.setAttribute("data-gate-seconds", "{gate_seconds}");
						s.setAttribute("data-gate-selector", "{gate_selector}");
						document.currentScript.parentNode.appendChild(s);
					}})();
				</script>
				<script>
					// Watch-to-connect: redeem the earned voucher and connect.
					document.addEventListener("splashnet:reward", function (e) {{
						var v = e.detail.voucher;
						var input = document.getElementById("voucherInput");
						if (input && v) {{ input.value = v; }}
						if (typeof setStorageValue === "function") {{
							setStorageValue("activeVoucher", v);
							setStorageValue(v + "validity", String(Date.now() + e.detail.minutes * 60000));
						}}
						setTimeout(function () {{ doLogin(); }}, 1200);
					}});
				</script>
"""
    marker = '<span class="status-disconnected">'
    assert marker in html, "login.html: injection marker missing (upstream drift?)"
    html = html.replace(marker, snippet + "\n                " + marker, 1)
    return html


def patch_core(js: str) -> str:
    n = js.count('"http://"+vendorIpAddress')
    assert n > 0, "core.js: no hardcoded vendo URLs found (upstream drift?)"
    return js.replace('"http://"+vendorIpAddress', 'location.protocol+"//"+vendorIpAddress')


def patch_config(js: str, vendo: str) -> str:
    assert 'var vendorIpAddress = "10.1.0.41";' in js, "config.js: vendorIpAddress default changed (upstream drift?)"
    js = js.replace('var vendorIpAddress = "10.1.0.41";', f'var vendorIpAddress = "{vendo}";')
    js = js.replace("var showMemberLogin = true;", "var showMemberLogin = false;")
    return js


def main() -> None:
    ap = argparse.ArgumentParser(description="Patch upstream JuanFi template into the splashnet fork")
    ap.add_argument("src", type=pathlib.Path, help="upstream template dir (e.g. mikrotik-template/4.3)")
    ap.add_argument("dst", type=pathlib.Path, help="output dir")
    ap.add_argument("--city", required=True)
    ap.add_argument("--type", dest="env_type", default="PISO_WIFI", choices=["PISO_WIFI", "POSTPAID"])
    ap.add_argument("--cluster", default="")
    ap.add_argument("--vendo", default="vendo.nxph.site", help="vendo host (no scheme)")
    ap.add_argument("--sdk-base", default="https://splash.nxph.site")
    ap.add_argument("--format", default="interstitial", choices=["inline", "interstitial"], help="ad display format (default: interstitial popup)")
    ap.add_argument("--gate-seconds", type=int, default=5, help="mandatory countdown before gated buttons unlock (0 = off)")
    ap.add_argument("--gate-selector", default="#insertBtn", help="CSS selector of buttons to gate behind the countdown")
    args = ap.parse_args()

    assert (args.src / "login.html").exists(), f"{args.src} does not look like a JuanFi template"
    if args.dst.exists():
        shutil.rmtree(args.dst)
    shutil.copytree(args.src, args.dst)

    (args.dst / "login.html").write_text(
        patch_login((args.dst / "login.html").read_text(), args.city, args.env_type, args.cluster, args.sdk_base, args.format, args.gate_seconds, args.gate_selector)
    )
    (args.dst / "assets/js/core.js").write_text(patch_core((args.dst / "assets/js/core.js").read_text()))
    (args.dst / "assets/js/config.js").write_text(patch_config((args.dst / "assets/js/config.js").read_text(), args.vendo))
    print(f"built fork at {args.dst} (city={args.city} type={args.env_type} vendo={args.vendo})")
    print("next: whitelist splash.nxph.site + cdn.nxph.site in the hotspot walled garden")


if __name__ == "__main__":
    sys.exit(main())
