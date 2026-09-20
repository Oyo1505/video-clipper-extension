# Zips the extension for addons.mozilla.org. Uses ZipArchive directly so entry names use "/"
# (Compress-Archive in Windows PowerShell 5.1 writes "\", which AMO rejects).
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path $PSScriptRoot -Parent
$version = (Get-Content "$root\manifest.json" -Raw | ConvertFrom-Json).version
$out = "$root\dist"
New-Item -ItemType Directory -Force $out | Out-Null
$zipPath = "$out\quickclip-firefox-$version.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }

$files = @(Get-Item "$root\manifest.json", "$root\overlay.css")
$files += Get-ChildItem "$root\src", "$root\icons" -Recurse -File

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
foreach ($f in $files) {
  $name = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $name, 'Optimal')
}
$zip.Dispose()
Write-Host "Cree: $zipPath"
