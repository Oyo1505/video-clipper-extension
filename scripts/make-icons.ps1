Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent

function New-RoundRect($x, $y, $w, $h, $r) {
  $d = $r * 2
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# Chrome Web Store: 128x128 canvas, artwork 96x96 with 16px transparent padding.
# Toolbar sizes (16/48) use a thinner margin so the glyph stays readable.
$sizes = @{ 16 = 0; 48 = 2; 128 = 16 }

foreach ($s in $sizes.Keys) {
  $pad = $sizes[$s]
  $a = $s - 2 * $pad                       # artwork size
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)

  # Rounded square, violet -> pink gradient
  $rect = New-Object System.Drawing.Rectangle $pad, $pad, $a, $a
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 124, 58, 237)), ([System.Drawing.Color]::FromArgb(255, 236, 72, 153)), 45
  $g.FillPath($brush, (New-RoundRect $pad $pad $a $a ($a * 0.24)))

  $white = [System.Drawing.Brushes]::White
  if ($s -ge 48) {
    # Play triangle (upper part)
    $pts = @(
      (New-Object System.Drawing.PointF ($pad + $a * 0.37), ($pad + $a * 0.17)),
      (New-Object System.Drawing.PointF ($pad + $a * 0.37), ($pad + $a * 0.55)),
      (New-Object System.Drawing.PointF ($pad + $a * 0.69), ($pad + $a * 0.36))
    )
    $g.FillPolygon($white, $pts)

    # Trim bar: faint full track, solid selected range, two end handles
    $faint = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(110, 255, 255, 255))
    $th = $a * 0.07
    $ty = $pad + $a * 0.76 - $th / 2
    $g.FillPath($faint, (New-RoundRect ($pad + $a * 0.16) $ty ($a * 0.68) $th ($th / 2)))
    # Selected range: solid band with a notch near each end (trim handles)
    $bh = $a * 0.17
    $by = $pad + $a * 0.76 - $bh / 2
    $g.FillPath($white, (New-RoundRect ($pad + $a * 0.30) $by ($a * 0.42) $bh ($bh * 0.3)))
    $notch = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 170, 60, 200))
    $nw = [Math]::Max(1.5, $a * 0.03); $nh = $bh * 0.6
    foreach ($nx in 0.345, 0.675) {
      $g.FillRectangle($notch, ($pad + $a * $nx - $nw / 2), ($pad + $a * 0.76 - $nh / 2), $nw, $nh)
    }
  } else {
    # 16px: bold play only
    $pts = @(
      (New-Object System.Drawing.PointF ($a * 0.34), ($a * 0.22)),
      (New-Object System.Drawing.PointF ($a * 0.34), ($a * 0.78)),
      (New-Object System.Drawing.PointF ($a * 0.78), ($a * 0.5))
    )
    $g.FillPolygon($white, $pts)
  }

  $bmp.Save("$root\icons\icon$s.png", [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
