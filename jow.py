"""
Flask Proxy API

Install:
    pip install flask requests pysocks pytricia

Files:
    - proxy.txt          -> berisi IP:PORT per baris
    - ipinfo_lite.json   -> database IPinfo Lite lokal (offline)

Endpoints:
    GET /api/proxy?license=contoh&type=socks5&geo=ALL&format=json|text|html
    GET /web/proxy?license=contoh&type=all&geo=ALL
    GET /api/reload

Catatan:
    - IPinfo Lite menyimpan data geolokasi per network/CIDR.
    - Script ini membaca file lokal ipinfo_lite.json, tidak pakai token dan tidak download dari URL.
    - Deteksi tipe proxy (http/https/socks4/socks5) dilakukan dengan probe koneksi.
"""

from __future__ import annotations

import json
import ipaddress
import os
import random
import socket
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict

import requests
from flask import Flask, request, Response, jsonify

try:
    import pytricia
except ImportError:
    pytricia = None


# =========================
# CONFIG
# =========================
APP_HOST = os.getenv("HOST", "0.0.0.0")
APP_PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "1") == "1"

PROXY_FILE = os.getenv("PROXY_FILE", "proxy.txt")
IPINFO_FILE = os.getenv("IPINFO_FILE", "ipinfo_lite.json")

# Ganti / tambah sesuai kebutuhan
VALID_LICENSES = {
    "contoh",
    "trial",
    "premium",
}

# Probe URL untuk cek apakah proxy benar-benar bisa dipakai.
# Pakai endpoint ringan untuk koneksi sederhana.
PROBE_HTTP_URL = os.getenv("PROBE_HTTP_URL", "http://api.ipify.org?format=json")
PROBE_HTTPS_URL = os.getenv("PROBE_HTTPS_URL", "https://api.ipify.org?format=json")
PROBE_TIMEOUT = float(os.getenv("PROBE_TIMEOUT", "7"))
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "32"))
AUTO_DETECT_TYPES = os.getenv("AUTO_DETECT_TYPES", "1") == "1"

SUPPORTED_TYPES = {"http", "https", "socks4", "socks5", "all"}

app = Flask(__name__)

# In-memory cache
ipinfo_index = None
proxy_cache: List[Dict[str, Any]] = []


# =========================
# DATA MODELS
# =========================
@dataclass
class ProxyEntry:
    ip: str
    port: int
    raw: str
    country_code: str = "XX"
    country_name: str = "Unknown"
    proxy_type: str = "unknown"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# =========================
# IPINFO LOADING + LOOKUP
# =========================
def load_ipinfo_records(path: str) -> List[Dict[str, Any]]:
    """Load ipinfo_lite.json.

    Mendukung:
      - JSON array
      - JSON object tunggal
      - NDJSON (satu objek per baris)
    """
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read().strip()

    if not raw:
        return []

    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        if isinstance(data, dict):
            return [data]
    except json.JSONDecodeError:
        pass

    records: List[Dict[str, Any]] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            if isinstance(obj, dict):
                records.append(obj)
        except json.JSONDecodeError:
            continue
    return records


def build_ipinfo_index(records: List[Dict[str, Any]]):
    """Buat index lookup IP -> data negara.

    Prioritas:
      1. pytricia kalau tersedia
      2. fallback list CIDR terurut (prefix paling spesifik dulu)
    """
    if pytricia is not None:
        v4 = pytricia.PyTricia(32)
        v6 = pytricia.PyTricia(128)

        for rec in records:
            network = rec.get("network")
            if not network:
                continue
            try:
                net = ipaddress.ip_network(network, strict=False)
            except ValueError:
                continue

            payload = {
                "country_code": rec.get("country_code") or rec.get("country") or "XX",
                "country_name": rec.get("country") or "Unknown",
                "network": str(net),
            }
            if net.version == 4:
                v4[str(net)] = payload
            else:
                v6[str(net)] = payload

        return {"mode": "pytricia", "v4": v4, "v6": v6}

    # Fallback tanpa dependency tambahan
    v4_items: List[Tuple[ipaddress._BaseNetwork, Dict[str, str]]] = []
    v6_items: List[Tuple[ipaddress._BaseNetwork, Dict[str, str]]] = []

    for rec in records:
        network = rec.get("network")
        if not network:
            continue
        try:
            net = ipaddress.ip_network(network, strict=False)
        except ValueError:
            continue

        payload = {
            "country_code": rec.get("country_code") or rec.get("country") or "XX",
            "country_name": rec.get("country") or "Unknown",
        }

        if net.version == 4:
            v4_items.append((net, payload))
        else:
            v6_items.append((net, payload))

    v4_items.sort(key=lambda x: x[0].prefixlen, reverse=True)
    v6_items.sort(key=lambda x: x[0].prefixlen, reverse=True)

    return {"mode": "linear", "v4": v4_items, "v6": v6_items}


def lookup_country(ip_str: str) -> Dict[str, str]:
    try:
        ip_obj = ipaddress.ip_address(ip_str)
    except ValueError:
        return {"country_code": "XX", "country_name": "Invalid IP"}

    if ipinfo_index is None:
        return {"country_code": "XX", "country_name": "Unknown"}

    if ipinfo_index["mode"] == "pytricia":
        tree = ipinfo_index["v4"] if ip_obj.version == 4 else ipinfo_index["v6"]
        try:
            key = tree.get_key(str(ip_obj))
            if not key:
                return {"country_code": "XX", "country_name": "Unknown"}
            return tree[key]
        except Exception:
            return {"country_code": "XX", "country_name": "Unknown"}

    items = ipinfo_index["v4"] if ip_obj.version == 4 else ipinfo_index["v6"]
    for net, payload in items:
        if ip_obj in net:
            return payload
    return {"country_code": "XX", "country_name": "Unknown"}


# =========================
# PROXY LOADING
# =========================
def parse_proxy_line(line: str) -> Optional[Tuple[str, int]]:
    raw = line.strip()
    if not raw or raw.startswith("#"):
        return None

    # Format utama: IP:PORT
    if raw.count(":") < 1:
        return None

    ip_part, port_part = raw.rsplit(":", 1)
    ip_part = ip_part.strip()
    port_part = port_part.strip()

    try:
        ipaddress.ip_address(ip_part)
        port = int(port_part)
        if not (1 <= port <= 65535):
            return None
    except Exception:
        return None

    return ip_part, port


def load_proxy_file(path: str) -> List[ProxyEntry]:
    entries: List[ProxyEntry] = []
    if not os.path.exists(path):
        return entries

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            parsed = parse_proxy_line(line)
            if not parsed:
                continue
            ip, port = parsed
            country = lookup_country(ip)
            entries.append(
                ProxyEntry(
                    ip=ip,
                    port=port,
                    raw=f"{ip}:{port}",
                    country_code=country["country_code"],
                    country_name=country["country_name"],
                )
            )
    return entries


# =========================
# PROXY TYPE DETECTION
# =========================
def _requests_session_for_proxy(proxy_url: str) -> requests.Session:
    s = requests.Session()
    s.proxies.update({"http": proxy_url, "https": proxy_url})
    s.trust_env = False
    return s


def _probe_with_proxy(proxy_url: str, url: str) -> bool:
    try:
        s = _requests_session_for_proxy(proxy_url)
        r = s.get(url, timeout=PROBE_TIMEOUT)
        return 200 <= r.status_code < 400
    except Exception:
        return False


def detect_proxy_type(ip: str, port: int) -> str:
    """Coba klasifikasikan proxy.

    Urutan:
      1. socks5
      2. socks4
      3. https proxy (TLS ke proxy)
      4. http proxy

    Catatan:
      - Banyak proxy HTTP bisa dipakai ke target HTTPS lewat CONNECT.
      - Kalau `https://IP:PORT` tidak berhasil, fallback ke `http`.
    """
    hostport = f"{ip}:{port}"

    # SOCKS5
    if _probe_with_proxy(f"socks5h://{hostport}", PROBE_HTTP_URL):
        return "socks5"

    # SOCKS4
    if _probe_with_proxy(f"socks4://{hostport}", PROBE_HTTP_URL):
        return "socks4"

    # HTTPS proxy (TLS ke proxy)
    if _probe_with_proxy(f"https://{hostport}", PROBE_HTTPS_URL):
        return "https"

    # HTTP proxy
    if _probe_with_proxy(f"http://{hostport}", PROBE_HTTP_URL):
        return "http"

    return "unknown"


def enrich_proxy_types(entries: List[ProxyEntry]) -> List[ProxyEntry]:
    if not AUTO_DETECT_TYPES:
        return entries

    # Deteksi paralel agar tidak terlalu lambat
    index_map: Dict[str, int] = {e.raw: i for i, e in enumerate(entries)}
    results: Dict[str, str] = {}

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {
            ex.submit(detect_proxy_type, e.ip, e.port): e.raw
            for e in entries
        }
        for fut in as_completed(futures):
            raw = futures[fut]
            try:
                results[raw] = fut.result()
            except Exception:
                results[raw] = "unknown"

    for e in entries:
        e.proxy_type = results.get(e.raw, "unknown")

    return entries


# =========================
# CACHE REFRESH
# =========================
def refresh_cache() -> None:
    global ipinfo_index, proxy_cache

    if not os.path.exists(IPINFO_FILE):
        raise FileNotFoundError(f"File IPinfo tidak ditemukan: {IPINFO_FILE}")

    ipinfo_records = load_ipinfo_records(IPINFO_FILE)
    ipinfo_index = build_ipinfo_index(ipinfo_records)

    proxies = load_proxy_file(PROXY_FILE)
    proxies = enrich_proxy_types(proxies)
    proxy_cache = [p.to_dict() for p in proxies]


# Load saat start
refresh_cache()


# =========================
# FILTERING + RENDERING
# =========================
def filter_proxies(
    entries: List[Dict[str, Any]],
    req_type: str = "all",
    geo: str = "ALL",
    mode: str = "list",
) -> List[Dict[str, Any]]:
    req_type = req_type.lower()
    geo = geo.upper()
    mode = mode.lower()

    data = entries

    if req_type != "all":
        data = [x for x in data if x.get("proxy_type", "unknown") == req_type]

    if geo != "ALL":
        data = [x for x in data if x.get("country_code", "XX").upper() == geo]

    if mode == "random" and data:
        return [random.choice(data)]

    return data


def group_by_country(entries: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    grouped: Dict[str, List[str]] = defaultdict(list)
    for x in entries:
        cc = x.get("country_code", "XX")
        grouped[cc].append(x.get("raw", f"{x.get('ip')}:{x.get('port')}"))
    return dict(grouped)


def render_text_grouped(entries: List[Dict[str, Any]]) -> str:
    grouped: Dict[str, List[str]] = defaultdict(list)
    for x in entries:
        key = f"{x.get('country_code', 'XX')} - {x.get('country_name', 'Unknown')}"
        grouped[key].append(x.get("raw", f"{x.get('ip')}:{x.get('port')}"))

    lines: List[str] = []
    for country in sorted(grouped.keys()):
        lines.append(f"[{country}]")
        lines.extend(grouped[country])
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_text_plain(entries: List[Dict[str, Any]]) -> str:
    return "\n".join(x.get("raw", f"{x.get('ip')}:{x.get('port')}" ) for x in entries) + ("\n" if entries else "")


def render_html_grouped(entries: List[Dict[str, Any]]) -> str:
    grouped: Dict[str, List[str]] = defaultdict(list)
    for x in entries:
        key = f"{x.get('country_code', 'XX')} - {x.get('country_name', 'Unknown')}"
        grouped[key].append(x.get("raw", f"{x.get('ip')}:{x.get('port')}"))

    parts = [
        "<!doctype html>",
        "<html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>",
        "<title>Proxy List</title>",
        "<style>",
        "body{font-family:Arial,Helvetica,sans-serif;background:#0b1020;color:#e8eefc;margin:0;padding:24px}",
        "h1,h2,p{margin:0 0 12px 0}",
        ".box{background:#121a33;border:1px solid #223055;border-radius:16px;padding:16px;margin-bottom:16px;box-shadow:0 6px 18px rgba(0,0,0,.2)}",
        "pre{white-space:pre-wrap;word-break:break-word;margin:0;font-size:14px;line-height:1.7}",
        ".muted{opacity:.75}",
        "</style></head><body>",
        "<h1>Proxy List</h1>",
        f"<p class='muted'>Total proxy: {len(entries)}</p>",
    ]

    for country in sorted(grouped.keys()):
        parts.append("<div class='box'>")
        parts.append(f"<h2>{country}</h2>")
        parts.append("<pre>")
        parts.append("\n".join(grouped[country]))
        parts.append("</pre>")
        parts.append("</div>")

    parts.append("</body></html>")
    return "\n".join(parts)


# =========================
# ROUTES
# =========================
@app.get("/")
def index():
    return jsonify({
        "status": "ok",
        "message": "Gunakan /api/proxy atau /web/proxy",
        "endpoints": {
            "/api/proxy": "JSON / text / html",
            "/web/proxy": "HTML dengan IP:PORT per baris",
            "/api/reload": "reload cache",
        },
    })


@app.get("/api/proxy")
def api_proxy():
    license_key = request.args.get("license", "").strip()
    req_type = request.args.get("type", "all").strip().lower()
    geo = request.args.get("geo", "ALL").strip().upper()
    mode = request.args.get("mode", "list").strip().lower()
    output_format = request.args.get("format", "json").strip().lower()

    if license_key not in VALID_LICENSES:
        return jsonify({"status": "error", "message": "Invalid license"}), 401

    if req_type not in SUPPORTED_TYPES:
        return jsonify({
            "status": "error",
            "message": "Invalid type. Use http, https, socks4, socks5, atau all."
        }), 400

    filtered = filter_proxies(proxy_cache, req_type=req_type, geo=geo, mode=mode)

    if output_format == "text":
        # Jika geo=ALL, tampilkan per negara; jika tidak, tampilkan baris biasa.
        if geo == "ALL":
            return Response(render_text_grouped(filtered), mimetype="text/plain")
        return Response(render_text_plain(filtered), mimetype="text/plain")

    if output_format == "html":
        return Response(render_html_grouped(filtered), mimetype="text/html")

    # JSON
    if geo == "ALL":
        grouped = group_by_country(filtered)
        return jsonify({
            "status": "success",
            "license": license_key,
            "type": req_type,
            "geo": geo,
            "mode": mode,
            "total": len(filtered),
            "countries": len(grouped),
            "data": grouped,
        })

    if not filtered:
        return jsonify({
            "status": "error",
            "message": f"Proxy tidak ditemukan untuk geo={geo} dan type={req_type}"
        }), 404

    return jsonify({
        "status": "success",
        "license": license_key,
        "type": req_type,
        "geo": geo,
        "mode": mode,
        "total": len(filtered),
        "data": [
            {
                "proxy": x.get("raw"),
                "country_code": x.get("country_code"),
                "country_name": x.get("country_name"),
                "proxy_type": x.get("proxy_type", "unknown"),
            }
            for x in filtered
        ],
    })


@app.get("/web/proxy")
def web_proxy():
    license_key = request.args.get("license", "").strip()
    req_type = request.args.get("type", "all").strip().lower()
    geo = request.args.get("geo", "ALL").strip().upper()
    mode = request.args.get("mode", "list").strip().lower()

    if license_key not in VALID_LICENSES:
        return Response("Invalid license", status=401, mimetype="text/plain")

    if req_type not in SUPPORTED_TYPES:
        return Response("Invalid type", status=400, mimetype="text/plain")

    filtered = filter_proxies(proxy_cache, req_type=req_type, geo=geo, mode=mode)
    return Response(render_html_grouped(filtered), mimetype="text/html")


@app.get("/api/reload")
def api_reload():
    try:
        refresh_cache()
        return jsonify({
            "status": "success",
            "message": "Cache berhasil di-reload",
            "total_proxy": len(proxy_cache),
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
        }), 500


@app.get("/api/scan/<path:target>")
def api_scan_single(target: str):
    """Scan satu proxy dari URL path /api/scan/IP:PORT

    Ini hanya untuk cek manual.
    """
    license_key = request.args.get("license", "").strip()
    if license_key not in VALID_LICENSES:
        return jsonify({"status": "error", "message": "Invalid license"}), 401

    if ":" not in target:
        return jsonify({"status": "error", "message": "Format harus IP:PORT"}), 400

    ip, port_s = target.rsplit(":", 1)
    try:
        port = int(port_s)
        ipaddress.ip_address(ip)
    except Exception:
        return jsonify({"status": "error", "message": "IP atau PORT tidak valid"}), 400

    country = lookup_country(ip)
    ptype = detect_proxy_type(ip, port)

    return jsonify({
        "status": "success",
        "proxy": f"{ip}:{port}",
        "country_code": country["country_code"],
        "country_name": country["country_name"],
        "proxy_type": ptype,
    })


# =========================
# MAIN
# =========================
if __name__ == "__main__":
    # Untuk production, pakai gunicorn/uwsgi bila diperlukan.
    app.run(host=APP_HOST, port=APP_PORT, debug=DEBUG)
