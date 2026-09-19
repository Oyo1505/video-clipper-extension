$root = Split-Path $PSScriptRoot -Parent
$version = (Get-Content "$root\manifest.json" -Raw | ConvertFrom-Json).version
$out = "$root\dist"
New-Item -ItemType Directory -Force $out | Out-Null
$zip = "$out\video-clipper-$version.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path "$root\manifest.json","$root\src","$root\overlay.css","$root\icons" -DestinationPath $zip
Write-Host "Cree: $zip"
