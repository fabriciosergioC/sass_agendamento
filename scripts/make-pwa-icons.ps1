# Gera os icones do PWA (Bela Face: monograma dourado sobre grafite) desenhando com GDI+.
# Nao instala nada: so System.Drawing, que ja vem no Windows PowerShell 5.1.
#
# ATENCAO: os icones atuais de public\icons vieram de uma foto (Gemini_Generated_Image)
# gerada com sharp. Rodar este script SOBRESCREVE todos eles com o monograma antigo.
# Use apenas se quiser voltar ao icone de monograma.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\make-pwa-icons.ps1
#
# Saida em public\icons (cada tamanho desenhado na resolucao final, nao redimensionado):
#   icon-master.png          1024  squircle de referencia (favicon, marketing)
#   icon-192.png              192  squircle, marca inteira
#   icon-512.png              512  idem; o Chrome usa este no splash screen
#   icon-maskable-192.png     192  full bleed, marca a 78% (launcher recorta circulo)
#   icon-maskable-512.png     512
#   apple-icon.png            180  full bleed, sem transparencia
#
# Parametros: -Text "BF" -Gold "#d4a24e" -GoldLight "#f0d49a" -Dark "#141210"
#             -Font "Palatino Linotype"
#
# Duas armadilhas deste arquivo, ambas ja mordidas aqui:
#   1) Escreva ASCII puro. O PowerShell 5.1 le .ps1 sem BOM como ANSI, entao um acento
#      UTF-8 vira lixo e pode quebrar ate um literal de cor.
#   2) PowerShell ignora maiuscula/minuscula nos nomes: "$dark = To-Color $Dark" dentro
#      de uma funcao amassa o param $Dark do script. Variaveis locais usam prefixo c.

param(
  [string]$Text = 'BF',
  [string]$Gold = '#d4a24e',
  [string]$GoldLight = '#f0d49a',
  [string]$Dark = '#141210',
  [string]$Font = 'Palatino Linotype'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function To-Color([string]$hex) {
  $h = $hex.TrimStart('#')
  if ($h.Length -eq 3) {
    $c = $h.ToCharArray()
    $h = '{0}{0}{1}{1}{2}{2}' -f $c[0], $c[1], $c[2]
  }
  return [System.Drawing.Color]::FromArgb(
    [Convert]::ToInt32($h.Substring(0, 2), 16),
    [Convert]::ToInt32($h.Substring(2, 2), 16),
    [Convert]::ToInt32($h.Substring(4, 2), 16)
  )
}

function Argb([int]$a, [System.Drawing.Color]$c) {
  return [System.Drawing.Color]::FromArgb($a, $c.R, $c.G, $c.B)
}

function Get-RoundedRect([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  if ($r -le 0) {
    # raio zero = quadrado cheio (AddArc recusa largura 0; AddRectangle so aceita um retangulo)
    $fullRect = New-Object System.Drawing.RectangleF($x, $y, $w, $h)
    [void]$p.AddRectangle($fullRect)
    return $p
  }
  $d = $r * 2
  # AddArc(x, y, LARGURA, ALTURA, anguloInicial, varredura)
  [void]$p.AddArc($x, $y, $d, $d, 180, 90)
  [void]$p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  [void]$p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  [void]$p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  [void]$p.CloseFigure()
  return $p
}

function Get-FirstFontFamily([string[]]$candidates) {
  $installed = [System.Drawing.FontFamily]::Families
  foreach ($name in $candidates) {
    foreach ($f in $installed) {
      if ($f.Name -eq $name) { return New-Object System.Drawing.FontFamily($name) }
    }
  }
  return [System.Drawing.FontFamily]::GenericSerif
}

# ------------------------------------------------------------------ a marca
# $radiusFrac: 0.19 = squircle dos icones comuns; 0 = full bleed (maskable / iOS).
# $markScale:  reduz so a marca (anel, monograma, brilho), mantendo o fundo ate a borda.
function New-Master([int]$size, [double]$radiusFrac, [double]$markScale) {
  $cGold = To-Color $Gold
  $cLight = To-Color $GoldLight
  $cDark = To-Color $Dark

  $cx = [single]($size / 2)
  $cy = [single]($size / 2 - $size * 0.012)   # sobe um pouco para dar chao ao filete
  $ms = [single]$markScale

  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $radius = [math]::Round($size * $radiusFrac)
  $shell = Get-RoundedRect ([single]0) ([single]0) ([single]$size) ([single]$size) ([single]$radius)
  $rectAll = New-Object System.Drawing.RectangleF([single]0, [single]0, [single]$size, [single]$size)
  $g.SetClip($shell, [System.Drawing.Drawing2D.CombineMode]::Replace)

  # fundo grafite com leve gradiente vertical
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rectAll,
    [System.Drawing.Color]::FromArgb(255, [math]::Min(255, $cDark.R + 22), [math]::Min(255, $cDark.G + 20), [math]::Min(255, $cDark.B + 16)),
    [System.Drawing.Color]::FromArgb(255, [math]::Max(0, $cDark.R - 6), [math]::Max(0, $cDark.G - 6), [math]::Max(0, $cDark.B - 6)),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
  )
  $g.FillRectangle($bg, $rectAll)

  # halo dourado atras da marca: PathGradientBrush pede GraphicsPath, nao RectangleF,
  # e a cor da borda e a propriedade SurroundColors (plural, vetor de cores).
  $glowW = [single]($size * 0.68 * $ms)
  $glowH = [single]($size * 0.76 * $ms)
  $glowRect = New-Object System.Drawing.RectangleF([single]($cx - $glowW / 2), [single]($cy - $glowH / 2), $glowW, $glowH)
  $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  [void]$glowPath.AddEllipse($glowRect)
  $glow = [System.Drawing.Drawing2D.PathGradientBrush]::new($glowPath)
  $glow.CenterColor = Argb 46 $cGold
  $glow.SurroundColors = @(Argb 0 $cGold)
  $g.FillPath($glow, $glowPath)

  # anel duplo (raios em % da arte: 38,5% e 34,8%)
  $ringR = [single]($size * 0.385 * $ms)
  $ringRect = New-Object System.Drawing.RectangleF([single]($cx - $ringR), [single]($size / 2 - $ringR), [single](2 * $ringR), [single](2 * $ringR))
  $outerPen = New-Object System.Drawing.Pen($cGold, [single]([math]::Max(2, $size * 0.009)))
  $g.DrawEllipse($outerPen, $ringRect)
  $innerR = [single]($size * 0.348 * $ms)
  $innerRect = New-Object System.Drawing.RectangleF([single]($cx - $innerR), [single]($size / 2 - $innerR), [single](2 * $innerR), [single](2 * $innerR))
  $innerPen = New-Object System.Drawing.Pen((Argb 150 $cGold), [single]([math]::Max(1, $size * 0.0035)))
  $g.DrawEllipse($innerPen, $innerRect)

  # monograma
  $family = Get-FirstFontFamily @($Font, 'Palatino Linotype', 'Georgia', 'Cambria', 'Times New Roman')
  $font = New-Object System.Drawing.Font($family, [single]($size * 0.37 * $ms), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $measure = $g.MeasureString($Text, $font)
  $textRect = New-Object System.Drawing.RectangleF([single]($cx - $measure.Width / 2), [single]($cy - $measure.Height / 2), [single]($measure.Width + 4), [single]($measure.Height + 4))
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

  $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 0, 0, 0))
  $shadowRect = New-Object System.Drawing.RectangleF([single]($textRect.X + $size * 0.006), [single]($textRect.Y + $size * 0.008), [single]$textRect.Width, [single]$textRect.Height)
  $g.DrawString($Text, $font, $shadowBrush, $shadowRect, $sf)

  $textBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $textRect,
    $cLight,
    [System.Drawing.Color]::FromArgb(255, [math]::Max(0, $cGold.R - 45), [math]::Max(0, $cGold.G - 40), [math]::Max(0, $cGold.B - 30)),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
  )
  $g.DrawString($Text, $font, $textBrush, $textRect, $sf)

  # filete embaixo do monograma
  $lineY = [single]($cy + $measure.Height / 2 - $size * 0.02)
  $lineHalf = [single]($measure.Width * 0.42)
  $linePen = New-Object System.Drawing.Pen($cGold, [single]([math]::Max(1.5, $size * 0.006)))
  $g.DrawLine($linePen, [single]($cx - $lineHalf), $lineY, [single]($cx + $lineHalf), $lineY)

  # brilho de 4 pontas, no alto a direita (posicao relativa ao centro, escala com a marca)
  $sx = [single]($cx + $size * 0.235 * $ms)
  $sy = [single]($cy - $size * 0.253 * $ms)
  $sa = [single]($size * 0.052 * $ms)
  $sb = [single]($size * 0.014 * $ms)
  $pts = @(
    (New-Object System.Drawing.PointF($sx, [single]($sy - $sa))),
    (New-Object System.Drawing.PointF([single]($sx + $sb), [single]($sy - $sb))),
    (New-Object System.Drawing.PointF([single]($sx + $sa), $sy)),
    (New-Object System.Drawing.PointF([single]($sx + $sb), [single]($sy + $sb))),
    (New-Object System.Drawing.PointF($sx, [single]($sy + $sa))),
    (New-Object System.Drawing.PointF([single]($sx - $sb), [single]($sy + $sb))),
    (New-Object System.Drawing.PointF([single]($sx - $sa), $sy)),
    (New-Object System.Drawing.PointF([single]($sx - $sb), [single]($sy - $sb)))
  )
  $sp = New-Object System.Drawing.Drawing2D.GraphicsPath
  [void]$sp.AddPolygon([System.Drawing.PointF[]]$pts)
  $sparkBrush = New-Object System.Drawing.SolidBrush $cLight
  $g.FillPath($sparkBrush, $sp)

  # o bitmap continua vivo (quem grava os PNGs e o chamador); os objetos GDI de desenho
  # saem aqui, na ordem inversa da criacao (fonte antes da familia).
  $g.Dispose()
  foreach ($obj in @($textBrush, $shadowBrush, $sparkBrush, $linePen, $outerPen, $innerPen,
                     $bg, $glow, $glowPath, $sf, $font, $family, $shell, $sp)) {
    if ($null -ne $obj) { $obj.Dispose() }
  }
  return $bmp
}

# ------------------------------------------------------------------ gravar
function Save-Icon($src, [string]$outPath, $bgColor) {
  # $src ja esta no tamanho final: aqui e so gravar o PNG e, quando pedido, preencher
  # uma cor atras dos pixels transparentes (o maskable nao pode ter canto vazio).
  if ($null -ne $bgColor) {
    $flat = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $fg = [System.Drawing.Graphics]::FromImage($flat)
    $fg.Clear([System.Drawing.Color]::FromArgb(255, $bgColor.R, $bgColor.G, $bgColor.B))
    [void]$fg.DrawImage($src, [single]0, [single]0, [single]$src.Width, [single]$src.Height)
    $flat.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $fg.Dispose(); $flat.Dispose()
  } else {
    $src.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  Write-Host ("  {0,-24} {1,4}px  {2,7:n0} KB" -f (Split-Path $outPath -Leaf), $src.Width, ((Get-Item $outPath).Length / 1KB))
}

function Save-AndDispose($src, [string]$outPath, $bgColor) {
  try { Save-Icon $src $outPath $bgColor } finally { $src.Dispose() }
}

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'public\icons'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$bgDark = To-Color $Dark

Write-Host 'Desenhando os icones...'
Save-AndDispose (New-Master 1024 0.19 1.0)   (Join-Path $outDir 'icon-master.png')        $null
Save-AndDispose (New-Master 192 0.19 1.0)    (Join-Path $outDir 'icon-192.png')           $null
Save-AndDispose (New-Master 512 0.19 1.0)    (Join-Path $outDir 'icon-512.png')           $null
# maskable: o launcher recorta um circulo e so o disco central (80% do lado) e garantido.
Save-AndDispose (New-Master 192 0.0 0.78)    (Join-Path $outDir 'icon-maskable-192.png')  $bgDark
Save-AndDispose (New-Master 512 0.0 0.78)    (Join-Path $outDir 'icon-maskable-512.png')  $bgDark
# iOS: a maquina aplica a propria mascara de squircle, entao o fundo vai ate a borda.
Save-AndDispose (New-Master 180 0.0 0.94)    (Join-Path $outDir 'apple-icon.png')         $bgDark

Write-Host 'OK - icones em public\icons'
