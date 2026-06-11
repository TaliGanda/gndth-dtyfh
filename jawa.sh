#!/bin/bash
# ======================================================
# Proxy Cycle Script
# Menjalankan scrape -> merge dengan valid sebelumnya -> cek proxy -> simpan valid
# Diulang setiap 30 menit
# ======================================================

# Konfigurasi
THREADS=100
SCRAPE_SCRIPT="scrape.py"
CHECK_SCRIPT="proxy2.go"
PROXY_FILE="proxy.txt"
VALID_FILE="valid_http.txt"
TEMP_MERGED="proxy_merged.txt"
LOG_FILE="cycle.log"

# Fungsi untuk mencatat log dengan timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Fungsi untuk menggabungkan dua file proxy dan menghapus duplikat
merge_files() {
    local file1=$1
    local file2=$2
    local output=$3
    if [[ -f "$file1" && -f "$file2" ]]; then
        cat "$file1" "$file2" | sort -u > "$output"
    elif [[ -f "$file1" ]]; then
        cp "$file1" "$output"
    elif [[ -f "$file2" ]]; then
        cp "$file2" "$output"
    else
        touch "$output"
    fi
}

# Fungsi untuk menjalankan pengecekan proxy
run_check() {
    log "Menjalankan pengecekan proxy dari $PROXY_FILE ..."
    # Hapus file valid lama agar proxy2.go membuat file baru (bukan append)
    [[ -f "$VALID_FILE" ]] && rm "$VALID_FILE"
    
    # Jalankan proxy2.go (pastikan Go terinstal dan dependencies siap)
    go run "$CHECK_SCRIPT" "$PROXY_FILE" "$THREADS" >> "$LOG_FILE" 2>&1
    if [[ $? -ne 0 ]]; then
        log "ERROR: Pengecekan proxy gagal!"
        return 1
    fi
    return 0
}

# Trap untuk menghentikan loop dengan Ctrl+C
trap 'log "Script dihentikan oleh user"; exit 0' INT

# Loop utama
while true; do
    log "=========================================="
    log "Memulai siklus baru"
    log "=========================================="

    # Step 1: Jalankan scraping
    log "Menjalankan scrape.py ..."
    python3 "$SCRAPE_SCRIPT" >> "$LOG_FILE" 2>&1
    if [[ $? -ne 0 ]]; then
        log "ERROR: Scrape gagal! Menunggu 30 detik lalu mencoba lagi..."
        sleep 30
        continue
    fi
    log "Scrape selesai. Jumlah proxy baru: $(wc -l < $PROXY_FILE 2>/dev/null || echo 0)"

    # Step 2: Gabungkan dengan proxy valid dari siklus sebelumnya (jika ada)
    if [[ -f "$VALID_FILE" ]]; then
        log "Menggabungkan $PROXY_FILE (hasil scrape) dengan $VALID_FILE (proxy valid sebelumnya)"
        merge_files "$PROXY_FILE" "$VALID_FILE" "$TEMP_MERGED"
        mv "$TEMP_MERGED" "$PROXY_FILE"
        local total=$(wc -l < "$PROXY_FILE" 2>/dev/null || echo 0)
        log "Hasil penggabungan: $total total proxy unik"
    else
        log "Tidak ada file $VALID_FILE sebelumnya, hanya menggunakan hasil scrape."
    fi

    # Step 3: Lakukan pengecekan proxy (menghasilkan valid_http.txt baru)
    run_check
    if [[ $? -ne 0 ]]; then
        log "Pengecekan gagal, tetap melanjutkan ke siklus berikutnya..."
    fi

    # Step 4: Tampilkan statistik
    if [[ -f "$VALID_FILE" ]]; then
        local valid_count=$(wc -l < "$VALID_FILE" 2>/dev/null || echo 0)
        log "Proxy valid ditemukan: $valid_count"
    else
        log "Tidak ada proxy valid yang ditemukan"
    fi

    log "Siklus selesai. Menunggu 30 menit sebelum siklus berikutnya..."
    sleep 1800   # 30 menit = 1800 detik
done
