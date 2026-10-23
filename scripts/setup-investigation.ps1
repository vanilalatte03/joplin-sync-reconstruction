$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    New-Item -ItemType Directory -Force 'work/tools' | Out-Null
    Copy-Item -LiteralPath 'investigation/tooling/package.json','investigation/tooling/package-lock.json' -Destination 'work/tools'
    npm ci --prefix work/tools --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
    $archive=Join-Path $projectRoot 'work/JoplinPortable.exe'
    if (-not (Test-Path -LiteralPath $archive)) {
        Invoke-WebRequest 'https://github.com/laurent22/joplin/releases/download/v3.7.21/JoplinPortable.exe' -OutFile $archive
    }
    $expected='5CF5686D8A3E2C1195448D1A0324602A2EF9A0CF61A867B323571CA2F8DD7B33'
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) { throw 'Joplin download digest mismatch' }
    $signature=Get-AuthenticodeSignature -LiteralPath $archive
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Joplin') { throw 'Joplin signature not verified' }
    & work/tools/node_modules/7zip-bin/win/x64/7za.exe x $archive '-owork/joplin-portable' -y
    if ($LASTEXITCODE -gt 1) { throw 'Joplin extraction failed' }
    # This file belongs only to this lab; never overwrite an existing client configuration.
    $config=Join-Path $projectRoot '.codex/config.toml'
    if (Test-Path -LiteralPath $config) { Write-Host 'Existing local Codex config retained.' }
    else {
        New-Item -ItemType Directory -Force (Split-Path $config -Parent) | Out-Null
        $nodePath=(Get-Command node.exe).Source.Replace('\','/')
        $reaPath=(Join-Path $projectRoot 'work/tools/node_modules/rea-agents/scripts/rea.mjs').Replace('\','/')
        @"
[mcp_servers.rea]
command = '$nodePath'
args = ['$reaPath', 'mcp']
startup_timeout_sec = 30
tool_timeout_sec = 180
"@ | Set-Content -LiteralPath $config -Encoding UTF8
    }
    node investigation/mcp-probe.mjs
    if ($LASTEXITCODE -ne 0) { throw 'REA MCP handshake failed' }
} finally { Pop-Location }
