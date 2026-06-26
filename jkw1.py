#!/usr/bin/env python3

import ipaddress
import random

INPUT = "ID_DE.txt"
OUTPUT = "ip_port.txt"

PORTS = [80, 999, 3128, 8080, 9090, 1328]

with open(OUTPUT, "w") as out:
    with open(INPUT) as f:
        for line in f:
            line = line.strip()

            if not line or line.startswith("#"):
                continue

            try:
                net = ipaddress.ip_network(line, strict=False)

                for ip in net:
                    ports = PORTS[:]
                    random.shuffle(ports)

                    for port in ports:
                        out.write(f"{ip}:{port}\n")

            except ValueError:
                pass

print(f"Done. Saved to {OUTPUT}")
