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
    "https://proxy.lost4apistresser.com/api/export?license=dbc4353d4e068995ffb1061b7164d889cdc586998a3349f7&type=all",
        "https://proxyspace.pro/http.txt",
        "https://openproxylist.xyz/http.txt",
        "https://api.proxyscrape.com/?request=displayproxies&proxytype=all",
        "https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.txt",
        "https://raw.githubusercontent.com/berkay-digital/proxy-scraper/main/proxies.txt",
        "https://raw.githubusercontent.com/officialputuid/kangproxy/kangproxy/xResults/Proxies.txt",
        "https://raw.githubusercontent.com/a2u/free-proxy-list/master/free-proxy-list.txt",
        "https://raw.githubusercontent.com/hendrikbgr/free-proxy-repo/master/proxy_list.txt",
        "https://raw.githubusercontent.com/almroot/proxylist/master/list.txt",
        "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt",
        "https://raw.githubusercontent.com/breakingtechfr/proxy_free/main/proxies/all.txt",
        "https://raw.githubusercontent.com/opsxcq/proxy-list/master/list.txt",
        "https://raw.githubusercontent.com/zevtyardt/proxy-list/main/all.txt",
        "https://raw.githubusercontent.com/prxchk/proxy-list/main/all.txt",
        "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies.txt",
        "https://raw.githubusercontent.com/mrmarble/proxy-list/main/all.txt",
        "https://raw.githubusercontent.com/elliottophellia/yakumo/master/results/mix_checked.txt",
        "https://raw.githubusercontent.com/mallisc5/master/proxy-list-raw.txt",
        "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list.txt",
        "https://raw.githubusercontent.com/tuanminpay/live-proxy/master/all.txt",
        "https://raw.githubusercontent.com/yuceltoluyag/goodproxy/main/raw.txt",
        "https://raw.githubusercontent.com/dpangestuw/free-proxy/main/All_proxies.txt",
        "https://raw.githubusercontent.com/mmpx12/proxy-list/master/proxies.txt",
        "https://raw.githubusercontent.com/andigwandi/free-proxy/main/proxy_list.txt",
        "https://raw.githubusercontent.com/crackmag/proxylist/proxy/proxy.list",
        "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/proxylist.txt",
        "https://raw.githubusercontent.com/tsprnay/proxy-lists/master/proxies/all.txt",
        "https://raw.githubusercontent.com/fate0/proxylist/master/proxy.list",
        "https://raw.githubusercontent.com/volkansah/auto-proxy-fetcher/main/proxies.txt",
        "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/all/data.txt",
        "https://sunny9577.github.io/proxy-scraper/proxies.txt",
        "https://multiproxy.org/txt/all/proxy.txt",
        "https://multiproxy.org/txt_all/proxy.txt",
        "http://rootjazz.com/proxies/proxies.txt",
        "http://alexa.lr2b.com/proxylist.txt",
        "https://proxyspace.pro/http.txt",
        "https://proxyspace.pro/http.txt",
        "https://openproxylist.xyz/http.txt",
        "https://api.proxyscrape.com/?request=displayproxies&proxytype=all",
        "https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.txt",
        "https://raw.githubusercontent.com/berkay-digital/proxy-scraper/main/proxies.txt",
        "https://raw.githubusercontent.com/officialputuid/kangproxy/kangproxy/xResults/Proxies.txt",
        "https://raw.githubusercontent.com/a2u/free-proxy-list/master/free-proxy-list.txt",
        "https://raw.githubusercontent.com/hendrikbgr/free-proxy-repo/master/proxy_list.txt",
        "https://raw.githubusercontent.com/almroot/proxylist/master/list.txt",
        "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt",
        "https://raw.githubusercontent.com/breakingtechfr/proxy_free/main/proxies/all.txt",
        "https://raw.githubusercontent.com/opsxcq/proxy-list/master/list.txt",
        "https://raw.githubusercontent.com/zevtyardt/proxy-list/main/all.txt",
        "https://raw.githubusercontent.com/prxchk/proxy-list/main/all.txt",
  "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies.txt",
  "https://raw.githubusercontent.com/mrmarble/proxy-list/main/all.txt",
  "https://raw.githubusercontent.com/elliottophellia/yakumo/master/results/mix_checked.txt",
  "https://raw.githubusercontent.com/mallisc5/master/proxy-list-raw.txt",
  "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list.txt",
  "https://raw.githubusercontent.com/tuanminpay/live-proxy/master/all.txt",
  "https://raw.githubusercontent.com/yuceltoluyag/goodproxy/main/raw.txt",
  "https://raw.githubusercontent.com/dpangestuw/free-proxy/main/All_proxies.txt",
  "https://raw.githubusercontent.com/mmpx12/proxy-list/master/proxies.txt",
  "https://raw.githubusercontent.com/andigwandi/free-proxy/main/proxy_list.txt",
  "https://raw.githubusercontent.com/crackmag/proxylist/proxy/proxy.list",
  "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/proxylist.txt",
  "https://raw.githubusercontent.com/tsprnay/proxy-lists/master/proxies/all.txt",
  "https://raw.githubusercontent.com/fate0/proxylist/master/proxy.list",
  "https://raw.githubusercontent.com/volkansah/auto-proxy-fetcher/main/proxies.txt",
  "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/all/data.txt",
  "https://sunny9577.github.io/proxy-scraper/proxies.txt",
  "https://multiproxy.org/txt/all/proxy.txt",
  "https://multiproxy.org/txt_all/proxy.txt",
  "http://rootjazz.com/proxies/proxies.txt",
  "http://alexa.lr2b.com/proxylist.txt",
  "https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/xResults/RAW.txt",
  "https://raw.githubusercontent.com/zloi-user/hideip.me/main/https.txt",
  "https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt",
  "https://raw.githubusercontent.com/UptimerBot/proxy-list/main/proxies/http.txt",
  "https://raw.githubusercontent.com/elliottophellia/yakumo/master/results/http/global/http_checked.txt",
  "https://raw.githubusercontent.com/ALIILAPRO/Proxy/main/http.txt",
  "https://raw.githubusercontent.com/casals-ar/proxy-list/main/http",
  "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
  "https://sunny9577.github.io/proxy-scraper/generated/http_proxies.txt",
  "https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/http/http.txt",
  "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/http.txt",
  "https://raw.githubusercontent.com/ObcbO/getproxy/master/file/http.txt",
  "https://raw.githubusercontent.com/monosans/proxy-list/refs/heads/main/proxies/http.txt",
  "https://www.proxy-list.download/api/v1/get?type=http",
  "https://raw.githubusercontent.com/dpangestuw/Free-Proxy/refs/heads/main/http_proxies.txt",
  "https://raw.githubusercontent.com/mmpx12/proxy-list/master/http.txt",
  "https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies/http.txt",
  "https://api.proxyscrape.com/?request=displayproxies&proxytype=http",
  "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt",
  "https://raw.githubusercontent.com/mertguvencli/http-proxy-list/main/proxy-list/data.txt",
  "https://raw.githubusercontent.com/saisuiu/Lionkings-Http-Proxys-Proxies/main/free.txt",
  "https://raw.githubusercontent.com/yemixzy/proxy-list/refs/heads/main/proxies/http.txt",
  "https://raw.githubusercontent.com/lhuwux/gado2/refs/heads/main/http2.txt",
  "https://raw.githubusercontent.com/Vann-Dev/proxy-list/main/proxies/http.txt",
  "https://raw.githubusercontent.com/proxy4parsing/proxy-list/main/http.txt",
  "https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/http.txt",
  "https://raw.githubusercontent.com/B4RC0DE-TM/proxy-list/main/HTTP.txt",
  "http://worm.rip/http.txt",
  "https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/http.txt",
  "https://api.openproxylist.xyz/http.txt",
  "https://api.proxyscrape.com/?request=getproxies&proxytype=http&timeout=10000&country=all&ssl=all&anonymity=all",
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=anonymous",
  "https://raw.githubusercontent.com/ErcinDedeoglu/proxies/main/proxies/http.txt",
  "https://raw.githubusercontent.com/zloi-user/hideip.me/main/http.txt",
  "https://raw.githubusercontent.com/tuanminpay/live-proxy/master/http.txt",
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all",
  "https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/generated/http_proxies.txt",
  "https://raw.githubusercontent.com/saisuiu/Lionkings-Http-Proxys-Proxies/main/cnfree.txt",
  "https://raw.githubusercontent.com/RX4096/proxy-list/main/online/http.txt",
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=1000000&country=all&ssl=all&anonymity=all",
  "https://raw.githubusercontent.com/miyukii-chan/proxy-list/master/proxies/http.txt",
  "https://github.com/ALIILAPRO/Proxy/raw/main/http.txt",
  "https://www.proxyscan.io/download?type=https",
  "https://vakhov.github.io/fresh-proxy-list/http.txt",
  "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
  "https://www.proxyscan.io/download?type=http",
  "https://raw.githubusercontent.com/babyhagey74/free-proxies/refs/heads/main/proxies/http/http.txt",
  "https://raw.githubusercontent.com/TuanMinPay/live-proxy/master/http.txt",
  "https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/http_proxies.txt",
  "https://naawy.com/api/public/proxylist/getList/?proxyType=http&format=txt",
  "https://raw.githubusercontent.com/fahimscirex/proxybd/master/proxylist/http.txt",
  "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt",
  "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies_anonymous/http.txt",
  "https://raw.githubusercontent.com/enseitankado/proxine/main/proxy/http.txt",
  "https://raw.githubusercontent.com/Tsprnay/Proxy-lists/master/proxies/http.txt",
  "https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies_anonymous/http.txt",
  "https://raw.githubusercontent.com/j0rd1s3rr4n0/api/main/proxy/http.txt",
  "https://raw.githubusercontent.com/mmpx12/proxy-list/refs/heads/master/http.txt",
  "https://openproxy.space/list/http",
  "https://raw.githubusercontent.com/proxylist-to/proxy-list/main/http.txt",
  "https://raw.githubusercontent.com/ProxyScraper/ProxyScraper/refs/heads/main/http.txt",
  "https://raw.githubusercontent.com/zenjahid/FreeProxy4u/master/http.txt",
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=1000&country=all&ssl=all&anonymity=anonymous",
  "https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/refs/heads/main/proxy_files/http_proxies.txt",
  "https://raw.githubusercontent.com/im-razvan/proxy_list/main/http.txt",
  "https://github.com/im-razvan/proxy_list/raw/main/http.txt",
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=1000000&country=all&ssl=all&anonymity=anonymous",
  "https://raw.githubusercontent.com/BreakingTechFr/Proxy_Free/main/proxies/http.txt",
  "https://raw.githubusercontent.com/caliphdev/Proxy-List/master/http.txt",
  "https://raw.githubusercontent.com/ProxyScraper/ProxyScraper/main/http.txt",
  "https://raw.githubusercontent.com/lhuwux/gado2/refs/heads/main/http.txt",
  "https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/refs/heads/master/http.txt",
  "https://raw.githubusercontent.com/ItzRazvyy/ProxyList/main/http.txt"
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
