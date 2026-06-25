#!/usr/bin/env python3
"""
Advanced high-speed async TCP proxy scanner with global scan, whitelist/blacklist,
port ranges, rate limiting, and output file.

Usage examples:
  # Scan whole IPv4 with whitelist and blacklist
  python proxy_scanner_advanced.py --global --whitelist my_targets.txt --blacklist exclude.txt --ports 80-999 --rate 1000 --output proxies.txt

  # Scan single CIDR with blacklist
  python proxy_scanner_advanced.py --range 192.168.0.0/24 --blacklist blacklist.txt --ports 8080,3128

  # Scan IP list from file
  python proxy_scanner_advanced.py --file ID_DE.txt --ports 80-999 --concurrency 500
"""

import asyncio
import ipaddress
import argparse
import sys
import time
from typing import List, Set, Generator, Optional

# ----------------------------------------------------------------------
# Helper: parse port string like "80,443,8000-9000" -> list of ints
# ----------------------------------------------------------------------
def parse_ports(port_str: str) -> List[int]:
    ports: Set[int] = set()
    for part in port_str.split(','):
        part = part.strip()
        if '-' in part:
            start, end = part.split('-', 1)
            try:
                start, end = int(start), int(end)
                if start > end:
                    start, end = end, start
                for p in range(start, end + 1):
                    if 1 <= p <= 65535:
                        ports.add(p)
            except ValueError:
                continue
        else:
            try:
                p = int(part)
                if 1 <= p <= 65535:
                    ports.add(p)
            except ValueError:
                continue
    return sorted(ports)

# ----------------------------------------------------------------------
# Load IPs/subnets from file (one per line, IP or CIDR)
# ----------------------------------------------------------------------
def load_networks(filename: str) -> List[ipaddress.IPv4Network]:
    nets = []
    with open(filename, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            try:
                # coba parse as network (with or without prefix)
                if '/' in line:
                    net = ipaddress.IPv4Network(line, strict=False)
                else:
                    net = ipaddress.IPv4Network(line + '/32', strict=False)
                nets.append(net)
            except ValueError:
                pass
    return nets

# ----------------------------------------------------------------------
# Generate target IPs based on arguments
# ----------------------------------------------------------------------
def generate_targets(
    use_global: bool = False,
    cidr_range: Optional[str] = None,
    file_path: Optional[str] = None,
    whitelist_file: Optional[str] = None,
    blacklist_file: Optional[str] = None
) -> Generator[str, None, None]:
    # Pre-load blacklist networks
    blacklist_nets: List[ipaddress.IPv4Network] = []
    if blacklist_file:
        blacklist_nets = load_networks(blacklist_file)

    # Determine primary source
    if whitelist_file:
        # Whitelist replaces other sources
        whitelist_nets = load_networks(whitelist_file)
        def whitelist_gen():
            for net in whitelist_nets:
                for ip in net.hosts():
                    yield ip
        source_gen = whitelist_gen()
    elif use_global:
        source_gen = ipaddress.IPv4Network('0.0.0.0/0').hosts()
    elif cidr_range:
        net = ipaddress.IPv4Network(cidr_range, strict=False)
        source_gen = net.hosts()
    elif file_path:
        # Baca file IP (one per line, bisa port diabaikan)
        def file_gen():
            with open(file_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    ip_candidate = line.split(':')[0]  # abaikan port jika ada
                    try:
                        ip = ipaddress.IPv4Address(ip_candidate)
                        yield ip
                    except ipaddress.AddressValueError:
                        continue
        source_gen = file_gen()
    else:
        raise ValueError("No target source specified.")

    # Apply blacklist filter
    if blacklist_nets:
        for ip in source_gen:
            # Cek apakah ip ada di salah satu blacklist network
            blacklisted = any(ip in net for net in blacklist_nets)
            if not blacklisted:
                yield str(ip)
    else:
        for ip in source_gen:
            yield str(ip)

# ----------------------------------------------------------------------
# Core scan functions
# ----------------------------------------------------------------------
async def check_port(sem: asyncio.Semaphore, ip: str, port: int, timeout: float) -> bool:
    try:
        async with sem:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(ip, port),
                timeout=timeout
            )
            writer.close()
            await writer.wait_closed()
            return True
    except (asyncio.TimeoutError, OSError, ConnectionRefusedError):
        return False
    except Exception:
        return False

async def check_proxy(sem: asyncio.Semaphore, ip: str, port: int, timeout: float) -> bool:
    try:
        async with sem:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(ip, port),
                timeout=timeout
            )
            request = (
                "GET http://example.com/ HTTP/1.0\r\n"
                "Host: example.com\r\n"
                "User-Agent: ProxyScanner/2.0\r\n"
                "Connection: close\r\n\r\n"
            )
            writer.write(request.encode())
            await writer.drain()

            response = await asyncio.wait_for(reader.readline(), timeout=timeout)
            writer.close()
            await writer.wait_closed()

            if response:
                first_line = response.decode(errors='ignore').strip()
                if first_line.startswith("HTTP/") and "200" in first_line:
                    body = await asyncio.wait_for(reader.read(100), timeout=1.0)
                    if b"<html" in body.lower() or b"<!doctype" in body.lower():
                        return True
            return False
    except Exception:
        return False

class Stats:
    """Thread-safe-ish counters for progress."""
    def __init__(self):
        self.scanned = 0
        self.open = 0
        self.proxies = 0
        self.lock = asyncio.Lock()

    async def increment_scanned(self):
        async with self.lock:
            self.scanned += 1

    async def increment_open(self):
        async with self.lock:
            self.open += 1

    async def increment_proxies(self):
        async with self.lock:
            self.proxies += 1

async def progress_reporter(stats: Stats, interval: float = 10.0):
    """Periodically print scan progress."""
    while True:
        await asyncio.sleep(interval)
        async with stats.lock:
            print(f"[*] Progress: {stats.scanned} IPs scanned, {stats.open} open ports, {stats.proxies} proxies found", flush=True)

async def worker(
    queue: asyncio.Queue,
    ports: List[int],
    concurrency: int,
    scan_timeout: float,
    proxy_timeout: float,
    stats: Stats,
    output_file: Optional[str] = None,
    output_queue: asyncio.Queue = None
):
    """Worker that grabs IPs from queue, scans ports, verifies proxies."""
    sem_port = asyncio.Semaphore(concurrency)      # limit concurrent port connects
    sem_proxy = asyncio.Semaphore(concurrency)     # limit concurrent proxy checks

    while True:
        ip = await queue.get()
        if ip is None:  # sentinel
            queue.task_done()
            break

        # Phase 1: port scan
        tasks = []
        for port in ports:
            tasks.append(asyncio.create_task(check_port(sem_port, ip, port, scan_timeout)))
        results = await asyncio.gather(*tasks)
        open_ports = [port for port, is_open in zip(ports, results) if is_open]

        await stats.increment_scanned()

        if open_ports:
            for port in open_ports:
                await stats.increment_open()
                # Phase 2: proxy verification
                is_proxy = await check_proxy(sem_proxy, ip, port, proxy_timeout)
                if is_proxy:
                    await stats.increment_proxies()
                    proxy_str = f"{ip}:{port}"
                    print(f"[PROXY] {proxy_str}")
                    if output_file:
                        # Gunakan output_queue agar penulisan file aman
                        await output_queue.put(proxy_str)

        queue.task_done()

async def file_writer(output_queue: asyncio.Queue, output_file: str):
    """Write found proxies to output file asynchronously."""
    with open(output_file, 'a') as f:
        while True:
            line = await output_queue.get()
            if line is None:
                break
            f.write(line + '\n')
            f.flush()
            output_queue.task_done()

# ----------------------------------------------------------------------
# Main scanner orchestrator
# ----------------------------------------------------------------------
async def run_scanner(
    targets: Generator[str, None, None],
    ports: List[int],
    concurrency: int,
    rate: Optional[int],
    scan_timeout: float,
    proxy_timeout: float,
    output_file: Optional[str]
):
    queue = asyncio.Queue(maxsize=concurrency * 2)  # buffer sedikit
    output_queue = asyncio.Queue() if output_file else None
    stats = Stats()

    # Start progress reporter
    progress_task = asyncio.create_task(progress_reporter(stats))

    # Start file writer if needed
    file_writer_task = None
    if output_file:
        file_writer_task = asyncio.create_task(file_writer(output_queue, output_file))

    # Create worker tasks
    workers = []
    for _ in range(concurrency):
        w = asyncio.create_task(worker(queue, ports, concurrency, scan_timeout, proxy_timeout, stats, output_file, output_queue))
        workers.append(w)

    # Producer: feed IPs with rate limiting
    delay = 1.0 / rate if rate and rate > 0 else 0.0
    ip_count = 0
    try:
        for ip in targets:
            await queue.put(ip)
            ip_count += 1
            if delay > 0:
                await asyncio.sleep(delay)
    except KeyboardInterrupt:
        print("\n[!] Interrupted. Waiting for workers to finish...")
    finally:
        # Send sentinels to workers
        for _ in range(concurrency):
            await queue.put(None)

    # Wait for all workers to finish
    await queue.join()
    for w in workers:
        await w

    # Stop file writer
    if output_queue:
        await output_queue.put(None)
        await file_writer_task

    # Stop progress reporter
    progress_task.cancel()
    try:
        await progress_task
    except asyncio.CancelledError:
        pass

    print(f"\n[+] Scan finished. Total IPs scanned: {stats.scanned}, open ports: {stats.open}, verified proxies: {stats.proxies}")

# ----------------------------------------------------------------------
# CLI Entry Point
# ----------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Advanced async TCP proxy scanner (ZMap-like)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Scan global with whitelist & blacklist:
    %(prog)s --global --whitelist target_networks.txt --blacklist exclude.txt --ports 80-999 --rate 2000

  Scan IP list file with port range:
    %(prog)s --file ID_DE.txt --ports 8080,3128,8000-9000

  Scan single subnet with blacklist:
    %(prog)s --range 10.0.0.0/8 --blacklist bad_subnets.txt
        """
    )
    # Sumber target (mutually exclusive jika whitelist tidak digunakan)
    source_group = parser.add_mutually_exclusive_group()
    source_group.add_argument('--global', dest='global_scan', action='store_true',
                              help='Scan the entire IPv4 address space')
    source_group.add_argument('--range', dest='cidr', help='Single CIDR range (e.g. 192.168.0.0/24)')
    source_group.add_argument('--file', dest='file', help='File with list of IPs (one per line)')

    parser.add_argument('--whitelist', help='File with allowed IPs/subnets (only these will be scanned)')
    parser.add_argument('--blacklist', help='File with IPs/subnets to exclude from scan')
    parser.add_argument('--ports', default='8080,3128,1080,8000,8888,8118',
                        help='Port(s) to scan, supports ranges (e.g. 80,443,8000-9000)')
    parser.add_argument('--concurrency', type=int, default=500,
                        help='Max concurrent connections (default: 500)')
    parser.add_argument('--rate', type=int, help='Max connections per second (rate limiting)')
    parser.add_argument('--scan-timeout', type=float, default=2.0,
                        help='Timeout for TCP connect (seconds)')
    parser.add_argument('--proxy-timeout', type=float, default=4.0,
                        help='Timeout for proxy validation (seconds)')
    parser.add_argument('--output', '-o', help='Output file to save verified proxies (ip:port)')

    args = parser.parse_args()

    # Validasi: jika whitelist tidak diset, harus ada sumber target
    if not args.whitelist and not (args.global_scan or args.cidr or args.file):
        parser.error("You must specify --whitelist or one of --global, --range, --file")

    # Parse ports
    ports = parse_ports(args.ports)
    if not ports:
        print("[!] No valid ports specified.")
        sys.exit(1)

    # Generate target iterator
    try:
        target_iter = generate_targets(
            use_global=args.global_scan,
            cidr_range=args.cidr,
            file_path=args.file,
            whitelist_file=args.whitelist,
            blacklist_file=args.blacklist
        )
    except Exception as e:
        print(f"[!] Error setting up targets: {e}")
        sys.exit(1)

    print(f"[*] Starting scan with {len(ports)} ports, concurrency={args.concurrency}, rate={args.rate or 'unlimited'}")
    if args.whitelist:
        print("[*] Using whitelist from", args.whitelist)
    if args.blacklist:
        print("[*] Using blacklist from", args.blacklist)

    try:
        asyncio.run(run_scanner(
            targets=target_iter,
            ports=ports,
            concurrency=args.concurrency,
            rate=args.rate,
            scan_timeout=args.scan_timeout,
            proxy_timeout=args.proxy_timeout,
            output_file=args.output
        ))
    except KeyboardInterrupt:
        print("\n[!] Aborted by user.")

if __name__ == "__main__":
    main()
