param(
  [ValidateSet('start', 'stop', 'status')]
  [string]$Action = 'start',
  [string]$BinPath = 'C:\Program Files\PostgreSQL\17\bin'
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dataPath = Join-Path $projectRoot '.local\postgres'
$logPath = Join-Path $projectRoot '.local\postgres.log'
$pgCtl = Join-Path $BinPath 'pg_ctl.exe'
if (-not (Test-Path -LiteralPath $pgCtl)) { throw "PostgreSQL tools not found at $BinPath. Pass -BinPath with your installation's bin folder." }

if ($Action -eq 'status') {
  & $pgCtl -D $dataPath status
  exit $LASTEXITCODE
}
if ($Action -eq 'stop') {
  & $pgCtl -D $dataPath -m fast -w stop
  exit $LASTEXITCODE
}

$envPath = Join-Path $projectRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) { throw 'Run npm run setup first.' }
$settings = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
  if ($line -match '^([A-Z_]+)=(.*)$') { $settings[$Matches[1]] = $Matches[2].Trim('"').Trim("'") }
}
$dbUser = $settings['POSTGRES_USER']
$dbName = $settings['POSTGRES_DB']
$dbPort = $settings['POSTGRES_PORT']
$dbPassword = $settings['POSTGRES_PASSWORD']
if ($dbUser -notmatch '^[a-z_][a-z0-9_]*$' -or $dbName -notmatch '^[a-z_][a-z0-9_]*$') { throw 'Use simple lowercase PostgreSQL user and database names.' }
if ($dbPort -notmatch '^\d+$' -or [int]$dbPort -lt 1 -or [int]$dbPort -gt 65535) { throw 'Invalid POSTGRES_PORT.' }
if (-not $dbPassword -or $dbPassword -eq '__LOCAL_DATABASE_PASSWORD__') { throw 'Set POSTGRES_PASSWORD or run npm run setup with no existing .env.' }

New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot '.local') | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $dataPath 'PG_VERSION'))) {
  $passwordFile = Join-Path $projectRoot '.local\init-password.tmp'
  try {
    [System.IO.File]::WriteAllText($passwordFile, $dbPassword, [System.Text.UTF8Encoding]::new($false))
    & (Join-Path $BinPath 'initdb.exe') -D $dataPath -U $dbUser -A scram-sha-256 --pwfile=$passwordFile --encoding=UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw 'initdb failed.' }
  } finally {
    Remove-Item -LiteralPath $passwordFile -Force -ErrorAction SilentlyContinue
  }
}

& $pgCtl -D $dataPath status *> $null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D $dataPath -l $logPath -o "-p $dbPort -h 127.0.0.1" -w start
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL failed to start. See $logPath. Check whether the port is occupied." }
}

$previousPassword = $env:PGPASSWORD
try {
  $env:PGPASSWORD = $dbPassword
  $exists = & (Join-Path $BinPath 'psql.exe') -h 127.0.0.1 -p $dbPort -U $dbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbName'"
  if ($LASTEXITCODE -ne 0) { throw 'Database connection failed.' }
  if ($exists -ne '1') {
    & (Join-Path $BinPath 'createdb.exe') -h 127.0.0.1 -p $dbPort -U $dbUser $dbName
    if ($LASTEXITCODE -ne 0) { throw 'Database creation failed.' }
  }
} finally {
  $env:PGPASSWORD = $previousPassword
}
Write-Output "Flux PostgreSQL is ready on 127.0.0.1:$dbPort. This isolated cluster lives in .local/postgres."
