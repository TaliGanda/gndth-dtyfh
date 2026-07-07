import asyncio
import aiohttp
import aiofiles
import time

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
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=15000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=14000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=13000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=12000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=11000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=10000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=9000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=8000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=7000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=6000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=5000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=4000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=3000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=2000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=1000&includeCountry=ID&type=all",
    "https://tools.elitestress.st/api/proxy?license=23ff5205bbe84ef0e4b2ab4ed0340922&type=socks5&geo=ALL",
    "https://tools.elitestress.st/api/proxy?license=e841d06798fd5ed7f460ad031e312454&type=socks5&geo=ID",
    "https://tools.elitestress.st/api/proxy?license=e841d06798fd5ed7f460ad031e312454&type=http&geo=ID",
    "https://tools.elitestress.st/api/proxy?license=e841d06798fd5ed7f460ad031e312454&type=https&geo=ID",
    "https://tools.elitestress.st/api/proxy?license=e841d06798fd5ed7f460ad031e312454&type=socks4&geo=ID"
]

MAX_CONCURRENT_REQUESTS = 200
total_proxies = 0


async def fetch_proxies(session, url):
    global total_proxies

    try:
        async with session.get(url, timeout=20) as response:
            if response.status == 200:
                data = await response.text()

                proxies = [
                    proxy.strip()
                    for proxy in data.splitlines()
                    if proxy.strip()
                ]

                total_proxies += len(proxies)

                async with aiofiles.open("proxy.txt", "a") as f:
                    await f.writelines(
                        [proxy + "\n" for proxy in proxies]
                    )

                print(f"[+] {len(proxies)} proxies from {url}")

            else:
                print(
                    f"[-] Failed to fetch {url} "
                    f"(Status: {response.status})"
                )

    except Exception as e:
        print(f"[-] Error fetching {url}: {e}")


async def main():
    async with aiofiles.open("proxy.txt", "w") as f:
        await f.write("")

    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT_REQUESTS)

    async with aiohttp.ClientSession(
        connector=connector
    ) as session:
        tasks = [
            fetch_proxies(session, url)
            for url in sources
        ]

        await asyncio.gather(*tasks)


if __name__ == "__main__":
    start_time = time.time()

    asyncio.run(main())

    print(
        f"\n[✓] File saved in proxy.txt "
        f"({total_proxies} proxies)"
    )
    print(
        f"[✓] Completed in "
        f"{time.time() - start_time:.2f} seconds"
    )
