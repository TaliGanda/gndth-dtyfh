import ipaddress
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

# Daftar rentang IP Indonesia berdasarkan APNIC
INDONESIAN_IP_RANGES = [
"36.66.0.0/16", "36.67.0.0/16", "39.192.0.0/14", "42.0.192.0/18", 
"49.128.0.0/13", "58.65.232.0/21", "61.5.64.0/18", "103.0.0.0/8", 
"110.232.64.0/18", "114.4.0.0/14", "180.244.0.0/14", "202.0.92.0/22", 
"202.0.96.0/19", "203.0.192.0/19", "103.16.0.0/11", "103.56.0.0/14", 
"103.104.0.0/13", "103.128.0.0/13", "103.176.0.0/12", "110.136.0.0/14", 
"111.92.0.0/13", "113.192.0.0/12", "118.96.0.0/12", "120.28.0.0/15", 
"122.155.0.0/16", "128.199.0.0/16", "139.59.0.0/16", "202.6.128.0/17", 
"202.152.0.0/14", "203.96.0.0/14", "203.160.0.0/13", "210.56.0.0/14", 
"211.0.0.0/13", "218.100.0.0/14", "222.124.0.0/15", "103.4.0.0/22", 
"103.5.0.0/22", "103.8.0.0/22", "103.10.0.0/22", "103.11.0.0/22", 
"103.12.0.0/22", "103.13.0.0/22", "103.14.0.0/22", "103.15.0.0/22", 
"103.16.0.0/22", "103.17.0.0/22", "103.18.0.0/22", "103.19.0.0/22", 
"103.20.0.0/22", "103.21.0.0/22", "103.22.0.0/22", "103.23.0.0/22", 
"103.24.0.0/22", "103.25.0.0/22", "103.26.0.0/22", "103.27.0.0/22", 
"103.28.0.0/22", "103.29.0.0/22", "103.30.0.0/22", "103.31.0.0/22", 
"103.32.0.0/22", "103.0.0.0/22", "103.33.0.0/22", "103.34.0.0/22", 
"103.35.0.0/22", "103.36.0.0/22", "103.37.0.0/22", "103.38.0.0/22", 
"103.39.0.0/22", "103.40.0.0/22", "103.41.0.0/22", "103.42.0.0/22", 
"103.43.0.0/22", "103.44.0.0/22", "103.45.0.0/22", "103.46.0.0/22", 
"103.47.0.0/22", "103.48.0.0/22", "103.49.0.0/22", "103.50.0.0/22", 
"103.51.0.0/22", "103.52.0.0/22", "103.53.0.0/22", "103.54.0.0/22"
]

def is_indonesian_ip(ip):
    try:
        ip_addr = ipaddress.IPv4Address(ip)
        return any(ip_addr in ipaddress.IPv4Network(network) for network in INDONESIAN_IP_RANGES)
    except ValueError:
        return False

def process_proxy(proxy):
    """Fungsi untuk memproses satu proxy"""
    proxy = proxy.strip()
    parts = proxy.split(":")
    if len(parts) == 2:  # Pastikan formatnya IP:PORT
        ip, port = parts
        if is_indonesian_ip(ip):
            return proxy
    return None

def main():
    # Baca file proxy.txt
    try:
        with open("proxy.txt", "r") as file:
            proxies = file.readlines()
    except FileNotFoundError:
        print("Error: File proxy.txt tidak ditemukan!")
        return
    except Exception as e:
        print(f"Error membaca file: {e}")
        return

    total_proxies = len(proxies)
    if total_proxies == 0:
        print("Tidak ada proxy yang ditemukan di proxy.txt")
        return

    print(f"Memulai filtering {total_proxies} proxy dengan threading...")
    print("Tekan Ctrl+C untuk menghentikan proses")

    filtered_proxies = []
    completed = 0
    lock = threading.Lock()

    # Fungsi untuk update progress
    def update_progress():
        nonlocal completed
        with lock:
            completed += 1
            progress = (completed / total_proxies) * 100
            sys.stdout.write(f"\rMemproses: [{'#' * (int(progress) // 2)}{'-' * (50 - int(progress) // 2)}] {progress:.2f}%")
            sys.stdout.flush()

    # Gunakan ThreadPoolExecutor untuk parallel processing
    with ThreadPoolExecutor(max_workers=150) as executor:  # 50 threads
        # Submit semua tugas
        future_to_proxy = {executor.submit(process_proxy, proxy): proxy for proxy in proxies}
        
        # Proses hasil yang selesai
        for future in as_completed(future_to_proxy):
            try:
                result = future.result()
                if result:
                    filtered_proxies.append(result)
                update_progress()
            except Exception as e:
                print(f"\nError memproses proxy: {e}")
                update_progress()

    # Simpan hasil ke file
    with open("indo.txt", "w") as file:
        for proxy in filtered_proxies:
            file.write(proxy + "\n")

    print(f"\nFilter selesai! {len(filtered_proxies)} proxy Indonesia telah disimpan di indo.txt")
    print(f"Success rate: {(len(filtered_proxies)/total_proxies)*100:.2f}%")

if __name__ == "__main__":
    main()
