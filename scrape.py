import asyncio
import aiohttp
import aiofiles
import time

sources = [
    "https://tools.elitestress.st/api/proxy?license=86f80427944dc8b7ca630ec3e3feed94&type=socks4&geo=ALL",
    "https://tools.elitestress.st/api/proxy?license=86f80427944dc8b7ca630ec3e3feed94&type=http&geo=ALL",
    "https://tools.elitestress.st/api/proxy?license=86f80427944dc8b7ca630ec3e3feed94&type=socks5&geo=ALL",
    "https://tools.elitestress.st/api/proxy?license=86f80427944dc8b7ca630ec3e3feed94&type=socks4&geo=ID",
    "https://tools.elitestress.st/api/proxy?license=86f80427944dc8b7ca630ec3e3feed94&type=http&geo=ID",
    "https://tools.elitestress.st/api/proxy?license=86f80427944dc8b7ca630ec3e3feed94&type=socks5&geo=ID",
    "https://proxyspace.pro/http.txt",
    "https://proxyspace.pro/https.txt",
    "https://proxyspace.pro/socks4.txt",
    "https://proxyspace.pro/socks5.txt",
    "https://openproxylist.xyz/http.txt",
    "https://openproxylist.xyz/https.txt",
    "https://openproxylist.xyz/socks4.txt",
    "https://openproxylist.xyz/socks5.txt"
]

MAX_CONCURRENT_REQUESTS = 200
total_proxies = 0

async def fetch_proxies(session, url):
    global total_proxies
    try:
        async with session.get(url, timeout=20) as response:
            if response.status == 200:
                data = await response.text()
                proxies = [proxy.strip() for proxy in data.strip().split("\n") if proxy.strip()]
                total_proxies += len(proxies)
                async with aiofiles.open("proxy.txt", "a") as f:
                    await f.writelines([proxy + "\n" for proxy in proxies])
                print(f"[+] {len(proxies)} proxies, from {url}")
            else:
                print(f"[-] Failed to fetch {url} (Status: {response.status})")
    except Exception as e:
        print(f"[-] Error fetching {url}:")

async def main():
    async with aiofiles.open("proxy.txt", "w") as f:
        await f.write("")

    async with aiohttp.ClientSession() as session:
        tasks = [fetch_proxies(session, url) for url in sources]
        await asyncio.gather(*tasks)

if __name__ == "__main__":
    start_time = time.time()
    asyncio.run(main())
    print(f"\n[✓] File saved in proxy.txt ({total_proxies} proxies)")
