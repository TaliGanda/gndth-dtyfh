import asyncio
import aiohttp
import aiofiles
import time

sources = [
    "https://www.proxyscrape.com/api?request=getproxies&proxytype=http",
    "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=1000&country=all",
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
    "https://www.proxy-list.download/api/v1/get?type=http",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt",
    "https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/http.txt",
    "https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/http/http.txt",
    "https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
    "https://raw.githubusercontent.com/proxylist-to/proxy-list/main/http.txt",
    "https://raw.githubusercontent.com/yuceltoluyag/GoodProxy/main/raw.txt",
    "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt",
    "https://raw.githubusercontent.com/mmpx12/proxy-list/master/https.txt",
    "https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/http_proxies.txt",
    "https://raw.githubusercontent.com/opsxcq/proxy-list/master/list.txt",
    "https://api.proxyscrape.com/v2/?request=displayproxies",
    "https://api.proxyscrape.com/?request=displayproxies&proxytype=all",
    "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all",
    "https://www.proxydocker.com/en/proxylist/download?email=noshare&country=all&city=all&port=all&type=all&anonymity=all&state=all&need=all",
    "https://proxy-spider.com/api/proxies.example.txt",
    "https://cdn.jsdelivr.net/gh/B4RC0DE-TM/proxy-list/SOCKS4.txt",
    "https://cdn.jsdelivr.net/gh/jetkai/proxy-list/online-proxies/txt/proxies-socks4.txt",
    "https://cdn.jsdelivr.net/gh/roosterkid/openproxylist/SOCKS4_RAW.txt",
    "https://cdn.jsdelivr.net/gh/prxchk/proxy-list/socks4.txt",
    "https://cdn.jsdelivr.net/gh/TheSpeedX/PROXY-List/socks4.txt",
    "https://proxyhub.me/en/all-sock5-proxy-list.html",
    "https://cdn.jsdelivr.net/gh/prxchk/proxy-list/socks5.txt",
    "https://cdn.jsdelivr.net/gh/jetkai/proxy-list/online-proxies/txt/proxies-socks5.txt",
    "https://cdn.jsdelivr.net/gh/mmpx12/proxy-list/socks5.txt",
    "https://cdn.jsdelivr.net/gh/roosterkid/openproxylist/SOCKS5_RAW.txt",
    "https://cdn.jsdelivr.net/gh/TheSpeedX/PROXY-List/socks5.txt",
    "https://proxyhub.me/en/all-http-proxy-list.html",
    "https://www.proxy-list.download/api/v1/get?type=http",
    "https://cdn.jsdelivr.net/gh/aslisk/proxyhttps/https.txt",
    "https://cdn.jsdelivr.net/gh/clarketm/proxy-list/proxy-list-raw.txt",
    "https://cdn.jsdelivr.net/gh/hendrikbgr/Free-Proxy-Repo/proxy_list.txt",
    "https://cdn.jsdelivr.net/gh/prxchk/proxy-list/http.txt",
    "https://cdn.jsdelivr.net/gh/jetkai/proxy-list/online-proxies/txt/proxies-http.txt",
    "https://cdn.jsdelivr.net/gh/mmpx12/proxy-list/https.txt",
    "https://cdn.jsdelivr.net/gh/roosterkid/openproxylist/HTTPS_RAW.txt",
    "https://cdn.jsdelivr.net/gh/ShiftyTR/Proxy-List/https.txt",
    "https://cdn.jsdelivr.net/gh/sunny9577/proxy-scraper/proxies.txt",
    "https://raw.githubusercontent.com/handeveloper1/Proxy/refs/heads/main/Proxies-Ercin/socks5.txt",
    "https://raw.githubusercontent.com/handeveloper1/Proxy/refs/heads/main/Proxies-Ercin/socks4.txt",
    "https://raw.githubusercontent.com/handeveloper1/Proxy/refs/heads/main/Proxies-Ercin/http.txt",
    "https://raw.githubusercontent.com/handeveloper1/Proxy/refs/heads/main/Proxies-Ercin/https.txt",
    "https://raw.githubusercontent.com/databay-labs/free-proxy-list/refs/heads/master/http.txt",
    "https://proxyspace.pro/http.txt",
    "https://proxyspace.pro/https.txt",
    "https://proxyspace.pro/socks4.txt",
    "https://proxyspace.pro/socks5.txt",
    "https://openproxylist.xyz/http.txt",
    "https://openproxylist.xyz/https.txt",
    "https://openproxylist.xyz/socks4.txt",
    "https://openproxylist.xyz/socks5.txt",
    "https://github.com/monosans/proxy-list/blob/main/proxies/http.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/refs/heads/main/proxies/socks4.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/refs/heads/main/proxies/socks5.txt",
    "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/refs/heads/master/socks5.txt",
    "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/refs/heads/master/socks4.txt",
    "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/refs/heads/master/http.txt",
    "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/refs/heads/master/proxylist.txt",
    "https://raw.githubusercontent.com/databay-labs/free-proxy-list/refs/heads/master/http.txt",
    "https://raw.githubusercontent.com/databay-labs/free-proxy-list/refs/heads/master/https.txt",
    "https://raw.githubusercontent.com/databay-labs/free-proxy-list/refs/heads/master/socks5.txt",
    "https://api.proxyscrape.com/v4/free-proxy-list/get?request=displayproxies&protocol=all&timeout=10000&country=all&ssl=all&anonymity=all",
    "https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=all&timeout=10000&country=all&ssl=all&anonymity=all&skip=0&limit=all"
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
