param([Parameter(ValueFromRemainingArguments=$true)][string[]]$MavenArgs)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$toolsRoot=Join-Path $projectRoot 'work/tools'
$mavenRoot=Join-Path $toolsRoot 'apache-maven-3.9.12'
if (-not (Test-Path -LiteralPath (Join-Path $mavenRoot 'bin/mvn.cmd'))) {
    New-Item -ItemType Directory -Force $toolsRoot | Out-Null
    $archive=Join-Path $toolsRoot 'apache-maven-3.9.12-bin.zip'
    $uri='https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.12/apache-maven-3.9.12-bin.zip'
    Invoke-WebRequest $uri -OutFile $archive
    $expected=((Invoke-WebRequest ($uri+'.sha512')).Content.Trim() -split '\s+')[0]
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA512).Hash -ine $expected) { throw 'Maven archive digest mismatch' }
    Expand-Archive -LiteralPath $archive -DestinationPath $toolsRoot -Force
}
Push-Location $projectRoot
try { & (Join-Path $mavenRoot 'bin/mvn.cmd') @MavenArgs; $exitCode=$LASTEXITCODE } finally { Pop-Location }
exit $exitCode
