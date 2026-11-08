<#
.SYNOPSIS
  Lance PHP avec le pilote PostgreSQL (pdo_pgsql) sous Windows, quel que soit le `php` du PATH.

.DESCRIPTION
  Le `php` du PATH est souvent celui de Herd (build statique) : il n'a ni pdo_pgsql ni pgsql, donc Pest, artisan migrate
  et scramble:export échouent avec « could not find driver ». Ce script choisit un PHP qui a le pilote :
    1. la variable d'environnement PHP_PGSQL_BIN (chemin complet de php.exe), si elle est définie ;
    2. C:\Users\<vous>\tools\php84\php.exe ;
    3. `php` du PATH, seulement s'il a pdo_pgsql.
  Il fixe memory_limit=1G (les 128 Mo par défaut ne suffisent pas à la suite Pest) et OPENSSL_CONF vers la
  configuration de Git for Windows si elle existe (certains tests RSA en ont besoin).
  Il n'écrit rien, ne modifie ni le PATH ni les fichiers php.ini.

.EXAMPLE
  .\scripts\php-pgsql.ps1 vendor/bin/pest --filter=HealthCheck
  .\scripts\php-pgsql.ps1 artisan migrate --force
  .\scripts\php-pgsql.ps1 -m          # liste des modules, pour vérifier pdo_pgsql
#>
$ErrorActionPreference = 'Stop'

$candidates = @()
if ($env:PHP_PGSQL_BIN) { $candidates += $env:PHP_PGSQL_BIN }
$candidates += (Join-Path $env:USERPROFILE 'tools\php84\php.exe')
$cmd = Get-Command php -ErrorAction SilentlyContinue
if ($cmd) { $candidates += $cmd.Source }

$php = $null
foreach ($c in $candidates) {
    $isPath = $c -match '[\\/]'
    if ($isPath -and (& { $m = & $c -m 2>$null; [bool]($m -match 'pdo_pgsql') })) { $php = $c; break }
}
if (-not $php) {
    Write-Error ("Aucun PHP avec pdo_pgsql trouvé. Essayés : " + ($candidates -join ', ') + ". Définir PHP_PGSQL_BIN avec le chemin d'un php.exe qui charge pdo_pgsql.")
    exit 2
}

$gitSsl = 'C:/Program Files/Git/usr/ssl/openssl.cnf'
if (-not $env:OPENSSL_CONF -and (Test-Path -LiteralPath $gitSsl)) { $env:OPENSSL_CONF = $gitSsl }

& $php -d memory_limit=1G @args
exit $LASTEXITCODE
