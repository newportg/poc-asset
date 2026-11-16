param(
    [ValidateRange(1, 65535)]
    [int]$ApiPort = 8001,

    [ValidateRange(1, 65535)]
    [int]$AssetApiPort = 8002,

    [ValidateRange(1, 65535)]
    [int]$ClientPort = 5175,

    [string]$CaCertificatePath
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$addressRepoRoot = (Resolve-Path (Join-Path $repoRoot "..\poc-address")).Path
$assetApiDirectory = Join-Path $repoRoot "api"
$apiDirectory = Join-Path $addressRepoRoot "api"
$clientSource = Join-Path $repoRoot "src"
$containerfile = Join-Path $apiDirectory "Containerfile"
$staticServer = Join-Path $PSScriptRoot "serve-client.js"
$imageName = "poc-address-loqate-api:local"
$containerName = "poc-asset-local-address-api-$PID"
$assetContainerName = "poc-asset-local-asset-api-$PID"
$assetImageName = "poc-asset-api:local"
$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "poc-asset-local-$([guid]::NewGuid().ToString('N'))"
$hostCaPath = $null
$staticProcess = $null
$containerStarted = $false
$assetContainerStarted = $false

function Invoke-Podman {
    param([string[]]$Arguments)

    & podman @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Podman command failed: podman $($Arguments -join ' ')"
    }
}

try {
    if (-not (Get-Command podman -ErrorAction SilentlyContinue)) {
        throw "Podman was not found. Install Podman Desktop or add podman to PATH."
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js was not found. Install Node.js to serve the Asset browser client."
    }
    if (-not (Test-Path $apiDirectory)) {
        throw "The sibling POC Address repository was not found at $addressRepoRoot."
    }

    Write-Host "Rebuilding Asset documentation..."
    & (Join-Path $PSScriptRoot "publish-docs.ps1")

    & podman info *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Starting the Podman machine..."
        Invoke-Podman @("machine", "start")
    }

    New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
    $clientDirectory = Join-Path $temporaryDirectory "client"
    Copy-Item -Path $clientSource -Destination $clientDirectory -Recurse
    Set-Content -LiteralPath (Join-Path $clientDirectory "config.js") `
        -Value "window.ADDRESS_API_BASE_URL = `"http://127.0.0.1:$ApiPort`"; window.ASSET_API_BASE_URL = `"http://127.0.0.1:$AssetApiPort`";" -Encoding ASCII

    if ($CaCertificatePath) {
        $resolvedCaPath = (Resolve-Path -LiteralPath $CaCertificatePath).Path
        $hostCaPath = Join-Path $temporaryDirectory "host-ca.crt"
        & certutil.exe -encode $resolvedCaPath $hostCaPath *> $null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not convert the supplied CA certificate to PEM format."
        }
    } else {
        $trustedCorporateRoot = Get-ChildItem Cert:\CurrentUser\Root,Cert:\LocalMachine\Root `
            -ErrorAction SilentlyContinue |
            Where-Object { $_.Subject -match "CN=Zscaler Root CA" } |
            Select-Object -First 1
        if ($trustedCorporateRoot) {
            $exportedCaPath = Join-Path $temporaryDirectory "host-ca.cer"
            $hostCaPath = Join-Path $temporaryDirectory "host-ca.crt"
            Export-Certificate -Cert $trustedCorporateRoot -FilePath $exportedCaPath -Type CERT | Out-Null
            & certutil.exe -encode $exportedCaPath $hostCaPath *> $null
            if ($LASTEXITCODE -ne 0) {
                throw "Could not convert the trusted Windows CA certificate to PEM format."
            }
            Write-Host "Using the trusted Windows Zscaler root CA for the container."
        }
    }

    Write-Host "Building the POC Address API image..."
    Invoke-Podman @(
        "build", "--network", "host", "--tag", $imageName,
        "--file", $containerfile, $apiDirectory
    )

    $localApiUrl = "http://127.0.0.1:$ApiPort"
    Write-Host "Starting the POC Address API container on $localApiUrl..."
    $runArguments = @("run", "--detach", "--name", $containerName, "--network", "host")
    if ($hostCaPath) {
        $runArguments += @("--volume", "$hostCaPath`:/run/host-ca/ca.crt:ro")
    }
    $runArguments += @("--env", "PORT=$ApiPort", $imageName)
    Invoke-Podman $runArguments
    $containerStarted = $true

    Write-Host "Building the Asset API image..."
    Invoke-Podman @(
        "build", "--network", "host", "--tag", $assetImageName,
        "--file", (Join-Path $assetApiDirectory "Containerfile"), $assetApiDirectory
    )
    $assetApiUrl = "http://127.0.0.1:$AssetApiPort"
    Write-Host "Starting the Asset API container on $assetApiUrl..."
    $assetRunArguments = @(
        "run", "--detach", "--name", $assetContainerName, "--network", "host",
        "--env", "PORT=$AssetApiPort",
        "--env", "ADDRESS_API_BASE_URL=$localApiUrl"
    )
    if ($env:LOQATE_API_KEY) {
        $assetRunArguments += @("--env", "LOQATE_API_KEY=$($env:LOQATE_API_KEY)")
    }
    $assetRunArguments += $assetImageName
    Invoke-Podman $assetRunArguments
    $assetContainerStarted = $true

    $apiReady = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            $health = Invoke-RestMethod -Uri "$localApiUrl/health" -TimeoutSec 2
            if ($health.status -eq "ok") {
                $apiReady = $true
                break
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $apiReady) {
        & podman logs $containerName
        throw "The POC Address API did not become healthy at $localApiUrl/health."
    }

    $assetApiReady = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            $health = Invoke-RestMethod -Uri "$assetApiUrl/health" -TimeoutSec 2
            if ($health.status -eq "ok") {
                $assetApiReady = $true
                break
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $assetApiReady) {
        & podman logs $assetContainerName
        throw "The Asset API did not become healthy at $assetApiUrl/health."
    }

    $clientUrl = "http://127.0.0.1:$ClientPort/"
    $stdoutLog = Join-Path $temporaryDirectory "client-server.out.log"
    $stderrLog = Join-Path $temporaryDirectory "client-server.err.log"
    $staticProcess = Start-Process -FilePath "node" `
        -ArgumentList @("`"$staticServer`"", "`"$clientDirectory`"", "$ClientPort") `
        -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog `
        -PassThru -WindowStyle Hidden

    $clientReady = $false
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        try {
            if ($staticProcess.HasExited) {
                break
            }
            $clientResponse = Invoke-WebRequest -Uri $clientUrl -TimeoutSec 2 -UseBasicParsing
            if ($clientResponse.Content -match "Asset Explorer") {
                $clientReady = $true
                break
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $clientReady) {
        if (Test-Path $stderrLog) {
            Get-Content -LiteralPath $stderrLog
        }
        throw "The Asset client server did not start correctly at $clientUrl."
    }

    Write-Host "Address API docs: $localApiUrl/docs"
    Write-Host "Asset API docs:   $assetApiUrl/docs"
    Write-Host "Asset client:    $clientUrl"
    Start-Process $clientUrl
    Read-Host "Press Enter to stop the Asset client and Address API"
} catch {
    Write-Error $_
    exit 1
} finally {
    if ($staticProcess -and -not $staticProcess.HasExited) {
        Stop-Process -Id $staticProcess.Id -Force
    }
    if ($containerStarted) {
        & podman stop --time 5 $containerName *> $null
        & podman rm $containerName *> $null
    }
    if ($assetContainerStarted) {
        & podman stop --time 5 $assetContainerName *> $null
        & podman rm $assetContainerName *> $null
    }
    if (Test-Path $temporaryDirectory) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
    }
}
