import asyncio
import aiohttp
import aiofiles
import time

sources = [
  "https://api.proxies.is/scraped?token=95u5E69Kncgi316U786fb&timeout=1000&excludeASN=AS14618,AS16509,AS55960,AS8987,AS7224,AS135629,AS62785,AS264167,AS274698,AS9059,AS21664,AS46489,AS401395,AS36263,AS395343,AS38895,AS801,AS39111,AS699,AS10124,AS19047,AS400098,AS17493,AS399991,AS40045,AS154263,AS58588,AS399834,AS63088,AS214101,AS135630,AS10291&includeASN=&excludeCountry=&includeCountry=AE,AF,AM,AZ,BD,BH,BN,BT,CN,CY,GE,HK,ID,IL,IN,IQ,IR,JO,JP,KG,KH,KP,KR,KW,KZ,LA,LB,LK,MM,MN,MO,MY,NP,OM,PH,PK,PS,QA,SA,SG,SY,TH,TJ,TM,TR,TW,UZ,VN,YE&type=",
  "https://api.proxies.is/scraped?token=95u5E69Kncgi316U786fb&timeout=2000&excludeASN=AS14618,AS16509,AS55960,AS8987,AS7224,AS135629,AS62785,AS264167,AS274698,AS9059,AS21664,AS46489,AS401395,AS36263,AS395343,AS38895,AS801,AS39111,AS699,AS10124,AS19047,AS400098,AS17493,AS399991,AS40045,AS154263,AS58588,AS399834,AS63088,AS214101,AS135630,AS10291&includeASN=&excludeCountry=&includeCountry=AE,AF,AM,AZ,BD,BH,BN,BT,CN,CY,GE,HK,ID,IL,IN,IQ,IR,JO,JP,KG,KH,KP,KR,KW,KZ,LA,LB,LK,MM,MN,MO,MY,NP,OM,PH,PK,PS,QA,SA,SG,SY,TH,TJ,TM,TR,TW,UZ,VN,YE&type=",
  "https://api.proxies.is/scraped?token=95u5E69Kncgi316U786fb&timeout=3000&excludeASN=AS14618,AS16509,AS55960,AS8987,AS7224,AS135629,AS62785,AS264167,AS274698,AS9059,AS21664,AS46489,AS401395,AS36263,AS395343,AS38895,AS801,AS39111,AS699,AS10124,AS19047,AS400098,AS17493,AS399991,AS40045,AS154263,AS58588,AS399834,AS63088,AS214101,AS135630,AS10291&includeASN=&excludeCountry=&includeCountry=AE,AF,AM,AZ,BD,BH,BN,BT,CN,CY,GE,HK,ID,IL,IN,IQ,IR,JO,JP,KG,KH,KP,KR,KW,KZ,LA,LB,LK,MM,MN,MO,MY,NP,OM,PH,PK,PS,QA,SA,SG,SY,TH,TJ,TM,TR,TW,UZ,VN,YE&type="
]

MAX_CONCURRENT_REQUESTS = 1

async def main():
    # 1. Baca proxy yang sudah ada di proxy.txt (jika ada)
    try:
        async with aiofiles.open("proxy.txt", "r") as f:
            old_content = await f.read()
            existing_proxies = set(old_content.splitlines())
    except FileNotFoundError:
        existing_proxies = set()

    # 2. Siapkan connector dan session
    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT_REQUESTS)
    async with aiohttp.ClientSession(connector=connector) as session:
        # Set untuk menampung proxy baru yang didapat
        new_proxies = set()
        total_new = 0

        async def fetch_and_collect(url):
            nonlocal total_new
            try:
                async with session.get(url, timeout=20) as response:
                    if response.status == 200:
                        data = await response.text()
                        proxies = {
                            proxy.strip()
                            for proxy in data.splitlines()
                            if proxy.strip()
                        }
                        new_proxies.update(proxies)
                        total_new += len(proxies)
                        print(f"[+] {len(proxies)} proxies from {url}")
                    else:
                        print(f"[-] Failed to fetch {url} (Status: {response.status})")
            except Exception as e:
                print(f"[-] Error fetching {url}: {e}")

        # 3. Jalankan semua request secara paralel (dibatasi oleh connector)
        tasks = [fetch_and_collect(url) for url in sources]
        await asyncio.gather(*tasks)

    # 4. Gabungkan proxy lama dan baru, lalu tulis ulang file (overwrite)
    all_proxies = existing_proxies | new_proxies
    async with aiofiles.open("proxy.txt", "w") as f:
        await f.writelines(p + "\n" for p in all_proxies)

    # 5. Tampilkan statistik
    print(f"\n[✓] Total unique proxies in file: {len(all_proxies)}")
    print(f"[✓] New proxies added: {len(new_proxies)} (out of {total_new} raw fetched)")

if __name__ == "__main__":
    start_time = time.time()
    asyncio.run(main())
    print(f"[✓] Completed in {time.time() - start_time:.2f} seconds")
