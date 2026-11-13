<#
.SYNOPSIS
  Environnement LOCAL d'apercu : backend Laravel reel + donnees de demonstration, pour verifier visuellement les ecrans
  connectes de l'application mobile dans l'apercu web Expo (navigateur). Voir docs/runbooks/apercu-local.md.

.DESCRIPTION
  Demarre, si besoin, trois processus locaux (tous sur 127.0.0.1, rien d'externe n'est contacte) :
    1. PostgreSQL 16 embarque, instance SEPAREE des tests (port 54350, base app_preview) via scripts/pg16-preview.mjs ;
    2. le serveur PHP integre sur le backend (port 8000, meme routeur que `php artisan serve`) ;
    3. un petit serveur statique (port 8001) pour les illustrations SVG des photos fictives.
  Puis execute `artisan migrate --force` et le PreviewSeeder, et affiche la commande Expo web.
  Les variables d'environnement du backend sont fixees pour ces processus uniquement (APP_ENV=local, file d'attente
  synchrone, pas de socket, pas de push, pas de stockage objet, pas d'appels video, pas d'achats) ; la session PowerShell
  appelante n'est pas modifiee. Aucun secret reel : APP_KEY et mot de passe sont generes localement (dans le dossier d'etat,
  hors depot) ; le mot de passe n'est jamais affiche.

  -Stop arrete uniquement ce que ce script a demarre et supprime les donnees jetables.

.PARAMETER Stop
  Arrete les processus demarres par ce script et supprime la base jetable.

.PARAMETER ApiPort / MediaPort / PgPort / WebPort
  Ports de l'API (8000), des photos fictives (8001), de PostgreSQL (54350) et de l'apercu web Expo (8089, utilise pour CORS).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/dev-preview.ps1
  powershell -ExecutionPolicy Bypass -File scripts/dev-preview.ps1 -Stop
#>
[CmdletBinding()]
param(
    [switch]$Stop,
    [int]$ApiPort = 8000,
    [int]$MediaPort = 8001,
    [int]$PgPort = 54350,
    [int]$WebPort = 8089,
    [string]$Database = 'app_preview'
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backend = Join-Path $repo 'backend'
$stateDir = Join-Path $env:TEMP 'ayelo-preview'
$stateFile = Join-Path $stateDir 'state.json'
$pgDir = Join-Path $stateDir 'pg'
$mediaDir = Join-Path $stateDir 'media'
$logDir = Join-Path $stateDir 'logs'
$passwordFile = Join-Path $stateDir 'preview-password.txt'
$keyFile = Join-Path $stateDir 'app-key.txt'
$apiUrl = "http://127.0.0.1:$ApiPort"
$email = 'apercu@example.test'

function Test-Port([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne(400) -and $client.Connected) { return $true }
        return $false
    } catch { return $false } finally { $client.Close() }
}

function Wait-Until([scriptblock]$Condition, [int]$Seconds, [string]$What) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if (& $Condition) { return }
        Start-Sleep -Milliseconds 500
    }
    throw "Delai depasse en attendant : $What (voir $logDir)"
}

function Read-State {
    if (Test-Path -LiteralPath $stateFile) { return (Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json) }
    return $null
}

function Save-State($State) {
    New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
    $State | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding ASCII
}

function Stop-Tree([int]$ProcessId) {
    if ($ProcessId -gt 0 -and (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
        & taskkill.exe /T /F /PID $ProcessId 2>&1 | Out-Null
    }
}

# ---------------------------------------------------------------- arret
if ($Stop) {
    $state = Read-State
    if ($null -eq $state) {
        Write-Host "Rien a arreter (aucun etat dans $stateDir)."
        exit 0
    }
    foreach ($name in 'media', 'api', 'pg') {
        $id = [int]($state.$name)
        if ($id -gt 0) {
            Stop-Tree $id
            Write-Host "Arrete : $name (PID $id)"
        }
    }
    Start-Sleep -Seconds 2
    foreach ($dir in $pgDir, $mediaDir) {
        if (Test-Path -LiteralPath $dir) { Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue }
    }
    Remove-Item -LiteralPath $stateFile -Force -ErrorAction SilentlyContinue
    Write-Host 'Apercu arrete, base jetable supprimee.'
    exit 0
}

# ---------------------------------------------------------------- outils
function Find-Php {
    $candidates = @()
    if ($env:PHP_PGSQL_BIN) { $candidates += $env:PHP_PGSQL_BIN }
    $candidates += (Join-Path $env:USERPROFILE 'tools\php84\php.exe')
    $candidates += @(Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages') -Filter php.exe -Recurse -Depth 2 -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
    $cmd = Get-Command php -ErrorAction SilentlyContinue
    if ($cmd) { $candidates += $cmd.Source }
    foreach ($c in $candidates) {
        if (-not (Test-Path -LiteralPath $c)) { continue }
        # Test sans lever d'erreur : un php dont une extension est bloquee (Smart App Control) ecrit sur stderr.
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $c
        $psi.Arguments = '-r "echo (extension_loaded(''pdo_pgsql'') && PHP_VERSION_ID >= 80401) ? ''ok'' : ''no'';"'
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true
        try {
            $p = [System.Diagnostics.Process]::Start($psi)
            $out = $p.StandardOutput.ReadToEnd()
            [void]$p.StandardError.ReadToEnd()
            $p.WaitForExit()
            if ($out -match 'ok') { return $c }
        } catch { }
    }
    throw "Aucun PHP >= 8.4.1 avec pdo_pgsql charge. Definir PHP_PGSQL_BIN (chemin de php.exe). Voir docs/runbooks/tests-locaux.md."
}

$php = Find-Php
$node = (Get-Command node -ErrorAction Stop).Source

# ---------------------------------------------------------------- secrets jetables (hors depot)
New-Item -ItemType Directory -Force -Path $stateDir, $logDir | Out-Null
if (-not (Test-Path -LiteralPath $keyFile)) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    Set-Content -LiteralPath $keyFile -Value ('base64:' + [Convert]::ToBase64String($bytes)) -Encoding ASCII
}
if (-not $env:PREVIEW_PASSWORD -and -not (Test-Path -LiteralPath $passwordFile)) {
    $bytes = New-Object byte[] 18
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $generated = ([Convert]::ToBase64String($bytes)).Replace('+', 'a').Replace('/', 'b').Replace('=', 'c')
    Set-Content -LiteralPath $passwordFile -Value $generated -Encoding ASCII
}
$previewPassword = if ($env:PREVIEW_PASSWORD) { $env:PREVIEW_PASSWORD } else { (Get-Content -LiteralPath $passwordFile -Raw).Trim() }
$appKey = (Get-Content -LiteralPath $keyFile -Raw).Trim()

# Environnement des processus enfants (valeurs vides = ecrasent aussi le fichier backend/.env, qui peut contenir des valeurs reelles).
$childEnv = [ordered]@{
    APP_ENV = 'local'; APP_DEBUG = 'true'; APP_KEY = $appKey; APP_URL = $apiUrl; APP_WEB_URL = "http://localhost:$WebPort"
    LOG_CHANNEL = 'stack'; LOG_STACK = 'single'; LOG_LEVEL = 'debug'
    DB_CONNECTION = 'pgsql'; DB_HOST = '127.0.0.1'; DB_PORT = "$PgPort"; DB_DATABASE = $Database; DB_USERNAME = 'postgres'; DB_PASSWORD = 'postgres'; DB_URL = ''
    QUEUE_CONNECTION = 'sync'; CACHE_STORE = 'database'; CACHE_PREFIX = 'preview'; SESSION_DRIVER = 'array'; SAFETY_STATE_STORE = ''
    BROADCAST_CONNECTION = 'null'; MAIL_MAILER = 'log'
    CORS_ALLOWED_ORIGINS = ''; CORS_DEV_ORIGINS = "http://localhost:$WebPort,http://127.0.0.1:$WebPort"
    MEDIA_ENDPOINT = "http://127.0.0.1:$MediaPort"; MEDIA_BUCKET = 'media'; MEDIA_ACCESS_KEY = 'preview-local'; MEDIA_SECRET_KEY = 'preview-local-not-a-secret'
    MEDIA_REGION = 'us-east-1'; MEDIA_AUTO_APPROVE = 'false'
    AWS_ACCESS_KEY_ID = ''; AWS_SECRET_ACCESS_KEY = ''; AWS_BUCKET = ''
    FCM_PROJECT_ID = ''; FCM_CLIENT_EMAIL = ''; FCM_PRIVATE_KEY = ''
    LIVEKIT_URL = ''; LIVEKIT_API_KEY = ''; LIVEKIT_API_SECRET = ''
    REVENUECAT_WEBHOOK_SECRET = ''
    REVERB_APP_ID = ''; REVERB_APP_KEY = ''; REVERB_APP_SECRET = ''; REVERB_HOST = ''
    GOOGLE_CLIENT_IDS = ''; APPLE_CLIENT_IDS = ''; SENTRY_LARAVEL_DSN = ''
    PREVIEW_PASSWORD = $previewPassword; PREVIEW_MEDIA_DIR = $mediaDir
}

# CreateProcess direct, SANS heritage de handles : un processus lance avec Process.Start heriterait des tuyaux de l'appelant
# (un appel via un outil ou une redirection ne rendrait jamais la main tant que les serveurs tournent). L'environnement est
# fourni explicitement, valeurs vides comprises (elles ecrasent aussi le fichier backend/.env).
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class PreviewLauncher
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct STARTUPINFO
    {
        public int cb; public string lpReserved; public string lpDesktop; public string lpTitle;
        public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public short wShowWindow, cbReserved2; public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct PROCESS_INFORMATION { public IntPtr hProcess; public IntPtr hThread; public int dwProcessId; public int dwThreadId; }
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern bool CreateProcessW(string app, StringBuilder cmd, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string cwd, ref STARTUPINFO si, out PROCESS_INFORMATION pi);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h, uint ms);
    [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr h, out uint code);

    // wait = false : retourne le PID ; wait = true : attend la fin et retourne le code de sortie.
    public static int Start(string commandLine, string workDir, string envBlock, bool wait)
    {
        STARTUPINFO si = new STARTUPINFO();
        si.cb = Marshal.SizeOf(typeof(STARTUPINFO));
        PROCESS_INFORMATION pi;
        IntPtr env = Marshal.StringToHGlobalUni(envBlock);
        try
        {
            // 0x08000000 = CREATE_NO_WINDOW, 0x400 = CREATE_UNICODE_ENVIRONMENT ; bInheritHandles = false
            if (!CreateProcessW(null, new StringBuilder(commandLine), IntPtr.Zero, IntPtr.Zero, false, 0x08000000u | 0x400u, env, workDir, ref si, out pi))
                throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            CloseHandle(pi.hThread);
            int result = pi.dwProcessId;
            if (wait)
            {
                WaitForSingleObject(pi.hProcess, 0xFFFFFFFFu);
                uint code; GetExitCodeProcess(pi.hProcess, out code);
                result = (int)code;
            }
            CloseHandle(pi.hProcess);
            return result;
        }
        finally { Marshal.FreeHGlobal(env); }
    }
}
"@

# Lance une commande via cmd.exe, sortie redirigee vers un journal ; retourne le PID (ou le code de sortie avec $Wait).
function Start-Logged([string]$Exe, [string]$Arguments, [string]$WorkDir, [string]$Log, [bool]$Wait = $false) {
    $vars = @{}
    foreach ($entry in [System.Environment]::GetEnvironmentVariables().GetEnumerator()) { $vars[[string]$entry.Key] = [string]$entry.Value }
    foreach ($k in $childEnv.Keys) { $vars[$k] = [string]$childEnv[$k] }
    if (-not $vars.ContainsKey('OPENSSL_CONF') -and (Test-Path 'C:/Program Files/Git/usr/ssl/openssl.cnf')) {
        $vars['OPENSSL_CONF'] = 'C:/Program Files/Git/usr/ssl/openssl.cnf'
    }
    $block = New-Object System.Text.StringBuilder
    foreach ($k in ($vars.Keys | Sort-Object)) { [void]$block.Append($k).Append('=').Append($vars[$k]).Append([char]0) }
    [void]$block.Append([char]0)
    $commandLine = "`"$env:ComSpec`" /c `"`"$Exe`" $Arguments > `"$Log`" 2>&1`""
    return [PreviewLauncher]::Start($commandLine, $WorkDir, $block.ToString(), $Wait)
}

function Invoke-Artisan([string]$What, [string]$Arguments, [string]$Log) {
    Write-Host "  $What ..."
    $code = Start-Logged $php "-d memory_limit=1G artisan $Arguments" $backend $Log $true
    if ($code -ne 0) {
        Write-Host (Get-Content -LiteralPath $Log -Tail 25 | Out-String)
        throw "Echec : $What (journal : $Log)"
    }
}

# ---------------------------------------------------------------- demarrage
$state = Read-State
if ($null -eq $state) { $state = [pscustomobject]@{ pg = 0; api = 0; media = 0 } }

Write-Host "PHP : $php"

if (Test-Port $PgPort) {
    Write-Host "PostgreSQL deja present sur $PgPort : reutilise."
} else {
    Write-Host "Demarrage de PostgreSQL 16 (port $PgPort, base $Database) ..."
    if (Test-Path -LiteralPath $pgDir) { Remove-Item -LiteralPath $pgDir -Recurse -Force }
    $pg = Start-Logged $node "`"$(Join-Path $repo 'scripts\pg16-preview.mjs')`" --port $PgPort --db $Database --dir `"$pgDir`"" $repo (Join-Path $logDir 'pg.log')
    $state.pg = $pg
    Save-State $state
    Wait-Until { Test-Port $PgPort } 120 "PostgreSQL sur le port $PgPort"
    Start-Sleep -Seconds 2
}

Write-Host 'Base de donnees :'
Invoke-Artisan 'migrate --force' 'migrate --force' (Join-Path $logDir 'migrate.log')
Invoke-Artisan 'PreviewSeeder (membre, 40 membres fictifs, affinites, conversations)' 'db:seed --class=Database\Seeders\PreviewSeeder --force' (Join-Path $logDir 'seed.log')

if (Test-Port $MediaPort) {
    Write-Host "Serveur de photos fictives deja present sur $MediaPort : reutilise."
} else {
    New-Item -ItemType Directory -Force -Path $mediaDir | Out-Null
    $media = Start-Logged $php "-S 127.0.0.1:$MediaPort -t `"$mediaDir`"" $mediaDir (Join-Path $logDir 'media.log')
    $state.media = $media
    Save-State $state
}

if (Test-Port $ApiPort) {
    Write-Host "Un serveur ecoute deja sur $ApiPort : reutilise (non demarre par ce script)."
} else {
    Write-Host "Demarrage de l'API (port $ApiPort) ..."
    # Meme routeur que `php artisan serve` ; php -S direct car artisan serve retire les variables d'environnement
    # (sauf une liste blanche) et relirait backend/.env, donc des valeurs reelles.
    $router = Join-Path $backend 'vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php'
    $api = Start-Logged $php "-d memory_limit=512M -S 127.0.0.1:$ApiPort `"$router`"" (Join-Path $backend 'public') (Join-Path $logDir 'api.log')
    $state.api = $api
    Save-State $state
    Wait-Until { Test-Port $ApiPort } 60 "API sur le port $ApiPort"
}

Wait-Until {
    try { (Invoke-WebRequest -Uri "$apiUrl/api/v1/health" -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200 } catch { $false }
} 60 'reponse de /api/v1/health'

Write-Host ''
Write-Host 'Apercu pret.'
Write-Host "  API            : $apiUrl/api/v1  (sante : $apiUrl/api/v1/health)"
Write-Host "  Membre         : $email"
Write-Host "  Mot de passe   : dans $passwordFile (genere, jetable ; non affiche)"
Write-Host "  Journaux       : $logDir"
Write-Host ''
Write-Host "Apercu web Expo (autre terminal, depuis la racine du depot) :"
Write-Host "  cd mobile"
Write-Host "  `$env:EXPO_PUBLIC_API_URL='$apiUrl'; `$env:CI='1'; npx expo start --web --port $WebPort"
Write-Host "  puis ouvrir http://localhost:$WebPort (l'URL de l'API est SANS /api/v1 : le client l'ajoute)."
Write-Host ''
Write-Host 'Arret : powershell -ExecutionPolicy Bypass -File scripts/dev-preview.ps1 -Stop'
