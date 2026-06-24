import asyncio
import aiohttp
import aiofiles
import time
import re
import random

# Masukkan daftar URL sumber Anda di sini
sources = [
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=15000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=14000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=13000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=12000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=11000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=10000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=9000&includeCountry=ID&type=all",
    "https://tools.elitestress.st/api/proxy?license=e841d06798fd5ed7f460ad031e312454&type=socks5&geo=ID",
    "https://tools.elitestress.st/api/proxy?license=e841d06798fd5ed7f460ad031e312454&type=http&geo=ID",
    "https://tools.elitestress.st/api/proxy?license=e841d06798fd5ed7f460ad031e312454&type=socks4&geo=ID",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=8000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=7000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=6000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=5000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=4000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=3000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=2000&includeCountry=ID&type=all",
    "https://api.proxies.is/scraped?token=7k6e6J11371Y8H6whs0bc&timeout=1000&includeCountry=ID&type=all"
]

MAX_CONCURRENT_REQUESTS = 15 # Ditingkatkan agar scraping lebih cepat
MAX_RETRIES = 3 # Jumlah maksimal percobaan ulang jika gagal
PROXY_PATTERN = re.compile(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}:[0-9]{1,5}\b') # Regex untuk ekstrak IP:PORT

# Gunakan set untuk menghindari duplikat
unique_proxies = set()

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36"
]

async def fetch_proxies(session, url):
    """Mengambil proxy dari URL dengan sistem retry dan regex extraction."""
    headers = {'User-Agent': random.choice(USER_AGENTS)}
    
    for attempt in range(MAX_RETRIES):
        try:
            # Timeout dinaikkan sedikit untuk menoleransi server lambat
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=25)) as response:
                if response.status == 200:
                    data = await response.text()
                    
                    # Cek website dan ambil hanya format IP:PORT dari teks apapun
                    found_proxies = PROXY_PATTERN.findall(data)
                    
                    if found_proxies:
                        unique_proxies.update(found_proxies)
                        print(f"[+] Berhasil: {len(found_proxies)} proxy dari {url.split('?')[0]}")
                        return # Keluar dari loop jika berhasil
                    else:
                        print(f"[-] Kosong: Tidak ada IP:PORT yang valid di {url.split('?')[0]}")
                        return
                else:
                    print(f"[*] Percobaan {attempt + 1} gagal (Status: {response.status}) untuk {url.split('?')[0]}")
                    
        except asyncio.TimeoutError:
            print(f"[*] Percobaan {attempt + 1} Timeout untuk {url.split('?')[0]}")
        except Exception as e:
            print(f"[*] Percobaan {attempt + 1} Error ({type(e).__name__}) untuk {url.split('?')[0]}")
        
        # Jeda sebelum mencoba lagi (Backoff)
        await asyncio.sleep(2 ** attempt) 
    
    print(f"[-] GAGAL TOTAL: {url.split('?')[0]} setelah {MAX_RETRIES} percobaan.")


async def main():
    print(f"[*] Memulai scraping dari {len(sources)} sumber...")
    
    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT_REQUESTS, verify_ssl=False) # Abaikan error SSL jika ada
    
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [fetch_proxies(session, url) for url in sources]
        await asyncio.gather(*tasks)
        
    # Tulis hasil akhir ke file sekaligus agar lebih efisien (tidak buka-tutup file berkali-kali)
    if unique_proxies:
        async with aiofiles.open("proxy.txt", "w") as f:
            await f.write("\n".join(unique_proxies) + "\n")


if __name__ == "__main__":
    start_time = time.time()
    
    # Menjalankan loop utama
    asyncio.run(main())
    
    print("-" * 40)
    print(f"[✓] Scraping selesai dalam {time.time() - start_time:.2f} detik")
    print(f"[✓] Berhasil menyimpan {len(unique_proxies)} proxy unik berformat IP:PORT ke proxy.txt")
