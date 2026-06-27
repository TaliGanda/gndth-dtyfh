import ipaddress

# Baca semua CIDR (abaikan IPv6 & baris kosong)
with open('cidr_list.txt', 'r') as f:
    lines = f.read().splitlines()

ipv4_cidrs = []
for line in lines:
    line = line.strip()
    if not line:
        continue
    try:
        # Hanya ambil jika IPv4 (otomatis gagal jika IPv6)
        net = ipaddress.IPv4Network(line, strict=False)
        ipv4_cidrs.append(net)
    except:
        pass

ports = [':999', ':80', ':8080', ':3128']

with open('ip_ports.txt', 'w') as out:
    for net in ipv4_cidrs:
        for ip in net.hosts():  # .hosts() mengabaikan network & broadcast
            ip_str = str(ip)
            for port in ports:
                out.write(f"{ip_str}{port}\n")

print(f"Selesai. Total IP: {sum(1 for _ in open('ip_ports.txt'))}")
