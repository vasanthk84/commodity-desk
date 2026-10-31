[CmdletBinding()]
param(
    [string]$Server = '165.227.84.87',
    [string]$SshUser = 'root',
    [switch]$BuildOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot
$python = Join-Path $projectRoot '.venv\Scripts\python.exe'
$privateEnv = Join-Path $projectRoot '.env'
if (-not (Test-Path -LiteralPath $python)) { throw 'Local Python environment is missing. Run start.bat first.' }
if ($Server -notmatch '^[A-Za-z0-9.-]+$' -or $SshUser -notmatch '^[A-Za-z0-9_-]+$') {
    throw 'Server or SSH user contains unexpected characters.'
}

function Assert-ExitCode([string]$step) {
    if ($LASTEXITCODE -ne 0) { throw "$step failed with exit code $LASTEXITCODE" }
}

Write-Host 'Running API tests...' -ForegroundColor Cyan
& $python -m unittest discover -s tests -q
Assert-ExitCode 'API tests'

$previousBase = $env:VITE_BASE_PATH
$previousApi = $env:VITE_API_BASE
try {
    $env:VITE_BASE_PATH = '/commodity-desk/'
    $env:VITE_API_BASE = '/commodity-desk-api'
    Write-Host 'Building Commodity Desk for the HTTPS subpath...' -ForegroundColor Cyan
    & npm run build
    Assert-ExitCode 'Frontend build'
} finally {
    if ($null -eq $previousBase) { Remove-Item Env:VITE_BASE_PATH -ErrorAction SilentlyContinue } else { $env:VITE_BASE_PATH = $previousBase }
    if ($null -eq $previousApi) { Remove-Item Env:VITE_API_BASE -ErrorAction SilentlyContinue } else { $env:VITE_API_BASE = $previousApi }
}

$releaseId = [guid]::NewGuid().ToString('N')
$remoteStage = "/root/commodity-desk-stage-$releaseId"
$localStage = Join-Path ([System.IO.Path]::GetTempPath()) "commodity-desk-stage-$releaseId"
$archive = Join-Path $localStage 'source.tar.gz'
$sshTarget = "${SshUser}@${Server}"
$null = New-Item -ItemType Directory -Path $localStage
$remoteCreated = $false

try {
    & $python scripts/package_release.py $archive
    Assert-ExitCode 'Release package'
    if ($BuildOnly) {
        Write-Host 'Build, tests and release package passed. No server was contacted.' -ForegroundColor Green
        return
    }

    Write-Host "Staging Commodity Desk on $Server..." -ForegroundColor Cyan
    & ssh -o BatchMode=yes -o StrictHostKeyChecking=yes $sshTarget "umask 077 && mkdir -p '$remoteStage'"
    Assert-ExitCode 'Remote staging'
    $remoteCreated = $true
    & scp -q $archive "${sshTarget}:${remoteStage}/source.tar.gz"
    Assert-ExitCode 'Release upload'
    if (Test-Path -LiteralPath $privateEnv) {
        if (-not (Select-String -LiteralPath $privateEnv -Pattern '^EIA_API_KEY=\S+' -Quiet)) {
            throw 'Local .env exists but has no EIA_API_KEY value.'
        }
        & scp -q $privateEnv "${sshTarget}:${remoteStage}/commodity-desk.env"
        Assert-ExitCode 'Private EIA configuration upload'
    }
    & scp -q (Join-Path $projectRoot 'deploy\setup-backend.sh') "${sshTarget}:${remoteStage}/setup-backend.sh"
    Assert-ExitCode 'Setup script upload'
    & ssh -o BatchMode=yes -o StrictHostKeyChecking=yes $sshTarget "bash '$remoteStage/setup-backend.sh' '$remoteStage'"
    Assert-ExitCode 'DigitalOcean setup'
    $remoteCreated = $false
} finally {
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
    if (Test-Path -LiteralPath $localStage) { Remove-Item -LiteralPath $localStage -Force }
    if ($remoteCreated) {
        & ssh -o BatchMode=yes -o StrictHostKeyChecking=yes $sshTarget "rm -f '$remoteStage/source.tar.gz' '$remoteStage/commodity-desk.env' '$remoteStage/setup-backend.sh' && rmdir '$remoteStage'" 2>$null
    }
}

$siteUrl = "https://$Server/commodity-desk/"
function Get-HttpStatus([string]$url) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
        return [int]$response.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        throw
    }
}
$uiStatus = Get-HttpStatus $siteUrl
$apiStatus = Get-HttpStatus "https://$Server/commodity-desk-api/api/health"
if ($uiStatus -ne 401 -or $apiStatus -ne 401) {
    throw "Expected protected frontend and API routes; received UI $uiStatus, API $apiStatus"
}
Write-Host "Commodity Desk deployed with HTTP Basic authentication: $siteUrl" -ForegroundColor Green
