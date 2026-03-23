#Tools By TaliGanda

import subprocess
import re
import ipaddress
import sys

CIDR_RE_IPV4 = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}/\d{1,2}\b')
CIDR_RE_IPV6 = re.compile(r'\b[0-9a-fA-F:]+/\d{1,3}\b')

def extract_cidrs(text):
    out = set()
    for m in CIDR_RE_IPV4.finditer(text):
        s = m.group(0)
        try:
            n = ipaddress.ip_network(s, strict=False)
            if n.version == 4:
                out.add(str(n))
        except Exception:
            pass
    for m in CIDR_RE_IPV6.finditer(text):
        s = m.group(0)
        try:
            n = ipaddress.ip_network(s, strict=False)
            if n.version == 6:
                out.add(str(n))
        except Exception:
            pass
    return out

def run_bgpq4(asn, ipv4=True, ipv6=False):
    cmd = ["bgpq4"]
    if ipv4 and not ipv6:
        cmd += ["-4"]
    elif ipv6 and not ipv4:
        cmd += ["-6"]
    cmd.append(asn)

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        txt = proc.stdout + "\n" + proc.stderr
        return extract_cidrs(txt)
    except FileNotFoundError:
        print("Error: bgpq4 tidak ditemukan. Install bgpq4 dulu.", file=sys.stderr)
        return set()
    except Exception as e:
        print("Error menjalankan bgpq4:", e, file=sys.stderr)
        return set()

def save_list(sorted_prefixes, filename):
    with open(filename, "w", encoding="utf-8") as f:
        for p in sorted_prefixes:
            f.write(p + "\n")

def sort_prefixes(prefixes):
    def keyfn(p):
        n = ipaddress.ip_network(p, strict=False)
        return (n.version, int(n.network_address), n.prefixlen)
    return sorted(prefixes, key=keyfn)

def single_asn():
    asn = input("Masukkan ASN (contoh AS13335): ").strip()
    if not asn:
        print("ASN kosong.")
        return
    out = input("Nama file output (contoh result.txt): ").strip() or "result.txt"
    prefixes = run_bgpq4(asn, ipv4=True, ipv6=False)
    final = sort_prefixes(prefixes)
    save_list(final, out)
    print(f"Saved {len(final)} prefixes to {out}")

def multi_asn():
    infile = input("Masukkan file list ASN (satu ASN per baris): ").strip()
    if not infile:
        print("File ASN tidak diberikan.")
        return
    out = input("Nama file output: ").strip() or "result.txt"
    allp = set()
    try:
        with open(infile, encoding="utf-8") as f:
            for ln in f:
                asn = ln.strip()
                if not asn:
                    continue
                print(f"Fetching {asn} ...")
                p = run_bgpq4(asn, ipv4=True, ipv6=False)
                allp.update(p)
    except FileNotFoundError:
        print("File ASN tidak ditemukan.")
        return

    final = sort_prefixes(allp)
    save_list(final, out)
    print(f"Saved {len(final)} prefixes to {out}")

def menu():
    while True:
        print("\n=== ASN TO CIDR TOOL ===")
        print("1. Single ASN")
        print("2. Multi ASN")
        print("3. Exit")
        pilih = input("Pilih menu: ").strip()
        if pilih == "1":
            single_asn()
        elif pilih == "2":
            multi_asn()
        elif pilih == "3":
            print("Keluar...")
            break
        else:
            print("Pilihan tidak valid")

if __name__ == "__main__":
    menu()
