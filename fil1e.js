const { spawn } = require("child_process");

const INTERVAL = 3 * 60 * 1000; // 3 menit
const WORKDIR = "/root/y";

let running = false;

function runCommand(command, args = []) {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            cwd: WORKDIR,
            stdio: "inherit",
        });

        child.on("error", (err) => {
            console.error(`${command} error:`, err.message);
            resolve(); // Tetap lanjut
        });

        child.on("close", (code) => {
            console.log(`${command} ${args.join(" ")} selesai (exit code: ${code})`);
            resolve(); // Tetap lanjut walaupun gagal
        });
    });
}

async function job() {
    if (running) {
        console.log(`[${new Date().toISOString()}] Job masih berjalan, skip.`);
        return;
    }

    running = true;

    console.log(`\n===== ${new Date().toLocaleString()} =====`);

    try {
        console.log("Menghapus proxy.txt...");
        await runCommand("rm", ["-rf", "proxy.txt"]);

        console.log("Menjalankan scrape.py...");
        await runCommand("python3", ["scrape.py"]);

        console.log("Menjalankan scrape1.py...");
        await runCommand("python3", ["scrape1.py"]);
    } finally {
        console.log("===== Job selesai =====\n");
        running = false;
    }
}

// Jalankan sekali saat pertama start
job();

// Ulang setiap 24 jam
setInterval(job, INTERVAL);
