$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$archivePath=Join-Path (Split-Path $projectRoot -Parent) 'joplin-sync-reconstruction.zip'
$manifest=Join-Path $projectRoot 'evidence/deliverable-sha256.json'
$files=Get-ChildItem -LiteralPath $projectRoot -Recurse -File | Where-Object {
    $relative=[IO.Path]::GetRelativePath($projectRoot,$_.FullName).Replace('\','/')
    $relative -notmatch '^(work|target|\.codex|\.git|node_modules)/' -and $relative -ne 'evidence/deliverable-sha256.json'
}
$entries=@($files | ForEach-Object {
    [ordered]@{path=[IO.Path]::GetRelativePath($projectRoot,$_.FullName).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash;bytes=$_.Length}
})
$entries | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifest -Encoding UTF8
$files=@($files)+(Get-Item -LiteralPath $manifest)
$stream=[IO.File]::Open($archivePath,[IO.FileMode]::Create)
$zip=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create)
try {
    foreach($file in $files) {
        $relative=[IO.Path]::GetRelativePath($projectRoot,$file.FullName).Replace('\','/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,('sync-lab/'+$relative),[IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $zip.Dispose();$stream.Dispose() }
Get-Item -LiteralPath $archivePath | Select-Object FullName,Length
