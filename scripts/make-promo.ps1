Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$out = "$root\store"
New-Item -ItemType Directory -Force $out | Out-Null

$W = 440; $H = 280
# 24bpp = no alpha channel, as the store requires
$bmp = New-Object System.Drawing.Bitmap $W,$H,([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'

function Rounded($x,$y,$w,$h,$r) {
  $d = $r*2
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x,$y,$d,$d,180,90); $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $p.AddArc($x,$y+$h-$d,$d,$d,90,90); $p.CloseFigure()
  return $p
}

# Background
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0,0,$W,$H),([System.Drawing.Color]::FromArgb(255,15,23,42)),([System.Drawing.Color]::FromArgb(255,12,74,110)),45
$g.FillRectangle($bg,0,0,$W,$H)

# App icon
$ix = 40; $iy = 42; $is = 64
$ib = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle $ix,$iy,$is,$is),([System.Drawing.Color]::FromArgb(255,34,211,238)),([System.Drawing.Color]::FromArgb(255,59,130,246)),45
$g.FillPath($ib,(Rounded $ix $iy $is $is 14))
$pts = @((New-Object System.Drawing.PointF ($ix+$is*0.38),($iy+$is*0.28)),(New-Object System.Drawing.PointF ($ix+$is*0.38),($iy+$is*0.72)),(New-Object System.Drawing.PointF ($ix+$is*0.74),($iy+$is*0.5)))
$g.FillPolygon([System.Drawing.Brushes]::White,$pts)

# Text
$title = New-Object System.Drawing.Font 'Segoe UI',26,([System.Drawing.FontStyle]::Bold),([System.Drawing.GraphicsUnit]::Pixel)
$sub = New-Object System.Drawing.Font 'Segoe UI',17,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('QuickClip for Video',$title,[System.Drawing.Brushes]::White,($ix+$is+16),($iy+2))
$soft = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,203,225,240))
$g.DrawString('Clip up to 60 s in seconds',$sub,$soft,($ix+$is+18),($iy+46))
$g.DrawString('Trim right on the player, save as WebM.',$sub,$soft,$ix,150)

# Mock trim bar
$bx = 40; $bw = 360; $by = 214
$track = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90,255,255,255))
$g.FillPath($track,(Rounded $bx ($by+6) $bw 6 3))
$rx = $bx+110; $rw = 150
$rb = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle $rx,$by,$rw,18),([System.Drawing.Color]::FromArgb(255,34,211,238)),([System.Drawing.Color]::FromArgb(255,59,130,246)),0
$g.FillRectangle($rb,$rx,$by,$rw,18)
$wp = New-Object System.Drawing.Pen ([System.Drawing.Color]::White),2
$g.DrawRectangle($wp,$rx,$by,$rw,18)
foreach ($hx in ($rx-4),($rx+$rw-4)) {
  $g.FillPath([System.Drawing.Brushes]::White,(Rounded $hx ($by-4) 8 26 4))
}

$bmp.Save("$out\promo-440x280.png",[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host "Cree: $out\promo-440x280.png"
