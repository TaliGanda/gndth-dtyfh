import asyncio
import aiohttp
import aiofiles
import time
import os

sources = [
    "https://proxyspace.pro/http.txt",
    "https://proxyspace.pro/https.txt",
    "https://proxyspace.pro/socks4.txt",
    "https://proxyspace.pro/socks5.txt",
    "https://openproxylist.xyz/http.txt",
    "https://openproxylist.xyz/https.txt",
    "https://openproxylist.xyz/socks4.txt",
    "https://openproxylist.xyz/socks5.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS4_RAW.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt",
    "https://api.proxies.is/scraped?token=k3gOC3I11kU287677f5ca&timeout=5000&includeCountry=&type=all",
    "https://api.proxies.is/scraped?token=k3gOC3I11kU287677f5ca&timeout=5000&includeCountry=ID&type=all",
    "https://tools.elitestress.st/api/proxy?license=23ff5205bbe84ef0e4b2ab4ed0340922&type=socks5&geo=ALL",
    "https://tools.elitestress.st/api/proxy?license=23ff5205bbe84ef0e4b2ab4ed0340922&type=http&geo=ALL",
    "https://tools.elitestress.st/api/proxy?license=23ff5205bbe84ef0e4b2ab4ed0340922&type=https&geo=ALL",
    "https://tools.elitestress.st/api/proxy?license=23ff5205bbe84ef0e4b2ab4ed0340922&type=socks4&geo=ALL"
]

MAX_CONCURRENT_REQUESTS = 200
all_proxies = []
seen = set()
new_count = 0

async def load_existing():
    if os.path.exists("proxy.txt"):
        async with aiofiles.open("proxy.txt", "r") as f:
            async for line in f:
                proxy = line.strip()
                if proxy and proxy not in seen:
                    seen.add(proxy)
                    all_proxies.append(proxy)

async def fetch_proxies(session, url, sem):
    global new_count
    try:
        async with sem:
            async with session.get(url, timeout=20) as response:
                if response.status == 200:
                    data = await response.text()
                    proxies = [p.strip() for p in data.splitlines() if p.strip()]

                    added = 0
                    for proxy in proxies:
                        if proxy not in seen:
                            seen.add(proxy)
                            all_proxies.append(proxy)
                            added += 1

                    new_count += added
                    print(f"[+] {added} new proxies from {url}")
                else:
                    print(f"[-] Failed to fetch {url} (Status: {response.status})")
    except Exception as e:
        print(f"[-] Error fetching {url}: {e}")

async def save_proxies():
    async with aiofiles.open("proxy.txt", "w") as f:
        await f.write("\n".join(all_proxies) + ("\n" if all_proxies else ""))

async def main():
    await load_existing()
    print(f"Loaded {len(all_proxies)} unique proxies from proxy.txt")

    sem = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

    async with aiohttp.ClientSession() as session:
        tasks = [fetch_proxies(session, url, sem) for url in sources]
        await asyncio.gather(*tasks)

    await save_proxies()

if __name__ == "__main__":
    start_time = time.time()
    asyncio.run(main())
    print(f"\n[✓] Added {new_count} new proxies")
    print(f"[✓] Total unique proxies: {len(all_proxies)}")
    print(f"[✓] File saved in proxy.txt")
    print(f"[✓] Time: {time.time() - start_time:.2f}s")
