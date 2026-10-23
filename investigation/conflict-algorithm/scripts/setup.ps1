$ErrorActionPreference='Stop'
$reportRoot=Split-Path $PSScriptRoot -Parent
Push-Location $reportRoot
try {
    if (Test-Path -LiteralPath 'work/conflict-lab') { throw 'Use a fresh copy for a new run; existing experiment profiles retained.' }
    New-Item -ItemType Directory -Force 'work/tools' | Out-Null
    Copy-Item -LiteralPath 'tooling/package.json','tooling/package-lock.json' -Destination 'work/tools'
    npm ci --prefix work/tools --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
    $archive=Join-Path $reportRoot 'work/JoplinPortable.exe'
    if (-not (Test-Path -LiteralPath $archive)) {
        Invoke-WebRequest 'https://github.com/laurent22/joplin/releases/download/v3.7.21/JoplinPortable.exe' -OutFile $archive
    }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne '5CF5686D8A3E2C1195448D1A0324602A2EF9A0CF61A867B323571CA2F8DD7B33') { throw 'Download hash mismatch' }
    $signature=Get-AuthenticodeSignature -LiteralPath $archive
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Joplin') { throw 'Signature not verified' }
    & work/tools/node_modules/7zip-bin/win/x64/7za.exe x $archive '-owork/joplin-portable' -y
    if ($LASTEXITCODE -gt 1) { throw 'Extraction failed' }
    Write-Host 'Local tools and isolated Desktop artifact ready. See docs/reproduction.md.'
} finally { Pop-Location }
