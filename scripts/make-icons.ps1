Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
foreach ($s in 16,48,128) {
  $bmp = New-Object System.Drawing.Bitmap $s,$s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $rect = New-Object System.Drawing.Rectangle 0,0,$s,$s
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect,([System.Drawing.Color]::FromArgb(255,145,70,255)),([System.Drawing.Color]::FromArgb(255,255,60,120)),45
  $r = [int]($s*0.22); $d = $r*2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0,0,$d,$d,180,90); $path.AddArc($s-$d,0,$d,$d,270,90)
  $path.AddArc($s-$d,$s-$d,$d,$d,0,90); $path.AddArc(0,$s-$d,$d,$d,90,90); $path.CloseFigure()
  $g.FillPath($brush,$path)
  $white = [System.Drawing.Brushes]::White
  $pts = @((New-Object System.Drawing.PointF ($s*0.38),($s*0.28)),(New-Object System.Drawing.PointF ($s*0.38),($s*0.72)),(New-Object System.Drawing.PointF ($s*0.74),($s*0.5)))
  $g.FillPolygon($white,$pts)
  $bmp.Save("$root\icons\icon$s.png",[System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
