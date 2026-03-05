import argparse
import json
import ipaddress
import sys

def load_blacklist(blacklist_file):
    """Load CIDR from AWS ip-ranges.json file."""
    networks = []
    try:
        with open(blacklist_file, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading blacklist file: {e}", file=sys.stderr)
        sys.exit(1)

    # IPv4 prefixes
    for item in data.get('prefixes', []):
        cidr = item.get('ip_prefix')
        if cidr:
            try:
                networks.append(ipaddress.ip_network(cidr))
            except ValueError:
                print(f"Warning: invalid IPv4 CIDR {cidr}", file=sys.stderr)

    # IPv6 prefixes
    for item in data.get('ipv6_prefixes', []):
        cidr = item.get('ipv6_prefix')
        if cidr:
            try:
                networks.append(ipaddress.ip_network(cidr))
            except ValueError:
                print(f"Warning: invalid IPv6 CIDR {cidr}", file=sys.stderr)

    return networks

def is_blacklisted(ip_str, networks):
    """Check if IP is in any of the networks."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        # Invalid IP format, treat as not blacklisted (or you can skip)
        return False
    for net in networks:
        if ip in net:
            return True
    return False

def filter_proxy_file(input_file, blacklist_file, output_file):
    networks = load_blacklist(blacklist_file)

    with open(input_file, 'r') as fin, open(output_file, 'w') as fout:
        for line_num, line in enumerate(fin, 1):
            line = line.strip()
            if not line:
                continue
            # Split by ':' to get IP part (assuming format ip:port)
            parts = line.split(':')
            if len(parts) < 2:
                print(f"Warning: line {line_num} does not contain IP:PORT format, skipped: {line}", file=sys.stderr)
                continue
            ip_str = parts[0].strip()
            if is_blacklisted(ip_str, networks):
                # Blacklisted, skip
                continue
            fout.write(line + '\n')

def main():
    parser = argparse.ArgumentParser(description='Filter proxy list by IP blacklist CIDR.')
    parser.add_argument('-i', '--input', required=True, help='Input file with IP:PORT per line')
    parser.add_argument('-b', '--blacklist', required=True, help='Blacklist JSON file (ip-ranges.json format)')
    parser.add_argument('-o', '--output', required=True, help='Output file for filtered proxies')
    args = parser.parse_args()

    filter_proxy_file(args.input, args.blacklist, args.output)
    print(f"Filtering complete. Output written to {args.output}")

if __name__ == '__main__':
    main()
