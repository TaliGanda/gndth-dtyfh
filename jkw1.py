#!/usr/bin/env python3

import ipaddress
import random
import urllib.request
import tempfile
import os

URL = "https://raw.githubusercontent.com/TaliGanda/gndth-dtyfh/refs/heads/main/ID_DE.txt"

PORTS = [
    80,
    999,
    3128,
    8080,
    9090,
    1328,
]

OUTPUT = "ip_port.txt"

print("[+] Downloading CIDR list...")

tmp = tempfile.NamedTemporaryFile(delete=False)
urllib.request.urlretrieve(URL, tmp.name)

print("[+] Expanding CIDRs...")

temp_output = tempfile.NamedTemporaryFile(delete=False, mode="w")

with open(tmp.name) as f:
    for line in f:
        line = line.strip()

        if not line or line.startswith("#"):
            continue

        try:
            net = ipaddress.ip_network(line, strict=False)

            for ip in net:
                ip = str(ip)
                ports = PORTS[:]
                random.shuffle(ports)

                for port in ports:
                    temp_output.write(f"{ip}:{port}\n")

        except Exception:
            pass

temp_output.close()

print("[+] Shuffling...")

with open(temp_output.name) as f:
    lines = f.readlines()

random.shuffle(lines)

with open(OUTPUT, "w") as f:
    f.writelines(lines)

os.unlink(tmp.name)
os.unlink(temp_output.name)

print(f"[+] Done -> {OUTPUT}")
print(f"[+] Total: {len(lines):,} entries")
