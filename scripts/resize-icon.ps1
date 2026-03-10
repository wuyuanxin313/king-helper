Param(
  [string]$InputPath = "$(Join-Path (Split-Path $PSScriptRoot -Parent) 'public' 'icon-source.png')",
  [string]$OutputPath = "$(Join-Path (Split-Path $PSScriptRoot -Parent) 'public' 'icon.png')",
  [int]$Size = 256
)

Add-Type -AssemblyName System.Drawing
if (-not (Test-Path $InputPath)) {
  Write-Error "未找到源图片: $InputPath"
  exit 1
}
$img = [System.Drawing.Image]::FromFile($InputPath)
$bmp = New-Object System.Drawing.Bitmap($Size, $Size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.DrawImage($img, 0, 0, $Size, $Size)
$g.Dispose()
$img.Dispose()
$bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "已生成 $OutputPath (${Size}x${Size})"
