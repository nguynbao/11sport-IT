<# :
@echo off
chcp 65001 >nul
title 11Sport - Bo Ket Noi May In Tem 2 Cot 70x20mm (Port 4000)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression ([System.IO.File]::ReadAllText('%~f0', [System.Text.Encoding]::UTF8))"
pause
exit /b
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   11SPORT - CONG CU TU DONG CAU HINH MAY IN 2 COT 70x20mm     " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

Add-Type -AssemblyName System.Drawing

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class ThermalDriverConfigSync {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct PRINTER_DEFAULTS {
        public IntPtr pDatatype;
        public IntPtr pDevMode;
        public int DesiredAccess;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, ref PRINTER_DEFAULTS pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "DocumentPropertiesW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int DocumentProperties(IntPtr hwnd, IntPtr hPrinter, string pDeviceName, IntPtr pDevModeOutput, IntPtr pDevModeInput, int fMode);

    [DllImport("kernel32.dll", ExactSpelling = true)]
    public static extern IntPtr GlobalAlloc(int uFlags, int dwBytes);

    [DllImport("kernel32.dll", ExactSpelling = true)]
    public static extern IntPtr GlobalLock(IntPtr hMem);

    [DllImport("kernel32.dll", ExactSpelling = true)]
    public static extern bool GlobalUnlock(IntPtr hMem);

    public static byte[] GetPatchedDevModeBytes(string printerName, short widthTenthsMm, short heightTenthsMm) {
        PRINTER_DEFAULTS pd = new PRINTER_DEFAULTS();
        pd.DesiredAccess = 0x00000008;
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, ref pd)) {
            return null;
        }
        try {
            int size = DocumentProperties(IntPtr.Zero, hPrinter, printerName, IntPtr.Zero, IntPtr.Zero, 0);
            if (size <= 0) return null;
            IntPtr pDevMode = Marshal.AllocHGlobal(size);
            try {
                int ret = DocumentProperties(IntPtr.Zero, hPrinter, printerName, pDevMode, IntPtr.Zero, 2);
                if (ret < 0) return null;

                int dmFields = Marshal.ReadInt32(pDevMode, 72);
                dmFields |= (1 | 2 | 4 | 8 | 0x00000800 | 0x10000000);
                Marshal.WriteInt32(pDevMode, 72, dmFields);
                Marshal.WriteInt16(pDevMode, 76, (short)1);
                Marshal.WriteInt16(pDevMode, 78, (short)256);
                Marshal.WriteInt16(pDevMode, 80, heightTenthsMm);
                Marshal.WriteInt16(pDevMode, 82, widthTenthsMm);
                Marshal.WriteInt16(pDevMode, 92, (short)1);
                if (size >= 204) {
                    Marshal.WriteInt32(pDevMode, 200, 1);
                }

                DocumentProperties(IntPtr.Zero, hPrinter, printerName, pDevMode, pDevMode, 10);

                Marshal.WriteInt16(pDevMode, 76, (short)1);
                Marshal.WriteInt16(pDevMode, 78, (short)256);
                Marshal.WriteInt16(pDevMode, 80, heightTenthsMm);
                Marshal.WriteInt16(pDevMode, 82, widthTenthsMm);
                Marshal.WriteInt16(pDevMode, 92, (short)1);
                if (size >= 204) {
                    Marshal.WriteInt32(pDevMode, 200, 1);
                }

                byte[] bytes = new byte[size];
                Marshal.Copy(pDevMode, bytes, 0, size);
                return bytes;
            } finally {
                Marshal.FreeHGlobal(pDevMode);
            }
        } finally {
            ClosePrinter(hPrinter);
        }
    }

    public static IntPtr AllocHDevModeFromBytes(byte[] bytes) {
        if (bytes == null || bytes.Length == 0) return IntPtr.Zero;
        IntPtr hMem = GlobalAlloc(0x0042, bytes.Length);
        if (hMem == IntPtr.Zero) return IntPtr.Zero;
        IntPtr ptr = GlobalLock(hMem);
        if (ptr == IntPtr.Zero) return IntPtr.Zero;
        try {
            Marshal.Copy(bytes, 0, ptr, bytes.Length);
        } finally {
            GlobalUnlock(hMem);
        }
        return hMem;
    }
}
"@

$script:Code128Patterns = @(
  "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
  "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
  "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
  "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
  "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
  "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
  "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
  "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
  "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
  "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
  "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
  "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
  "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
  "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
  "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
  "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
  "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
  "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
  "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
  "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
  "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
  "11010011100", "1100011101011"
)

$script:ThermalKeywords = @("xprinter", "xp-", "365b", "350b", "420b", "470b", "gprinter", "gp-", "zebra", "godex", "tsc", "bixolon", "pos", "thermal", "barcode", "label", "hprt", "rongta", "deli")

function Test-IsThermal([string]$name, [string]$driver) {
  $comb = ("$name $driver").ToLowerInvariant()
  foreach ($kw in $script:ThermalKeywords) {
    if ($comb.Contains($kw)) { return $true }
  }
  return $false
}

function ConvertTo-Code128RawPattern([string]$rawCode) {
  $clean = ($rawCode -replace '[^\x20-\x7E]', '').Trim()
  if ([string]::IsNullOrEmpty($clean)) { $clean = "ITEM" }

  function Get-DigitRun([string]$str, [int]$startIdx) {
    $cnt = 0
    while (($startIdx + $cnt) -lt $str.Length) {
      $c = [int][char]$str[$startIdx + $cnt]
      if ($c -ge 48 -and $c -le 57) { $cnt++ } else { break }
    }
    return $cnt
  }

  $codes = New-Object System.Collections.Generic.List[int]
  $idx = 0
  $initDigits = Get-DigitRun $clean 0
  $mode = if ($initDigits -ge 4) { 'C' } else { 'B' }
  $codes.Add($(if ($mode -eq 'C') { 105 } else { 104 }))

  while ($idx -lt $clean.Length) {
    if ($mode -eq 'C') {
      $dCount = Get-DigitRun $clean $idx
      if ($dCount -ge 2) {
        $codes.Add([int]::Parse($clean.Substring($idx, 2)))
        $idx += 2
      } else {
        $codes.Add(100)
        $mode = 'B'
      }
    } else {
      $dCount = Get-DigitRun $clean $idx
      if ($dCount -ge 4) {
        if (($dCount % 2) -eq 1) {
          $codes.Add([int][char]$clean[$idx] - 32)
          $idx += 1
        }
        $codes.Add(99)
        $mode = 'C'
      } else {
        $codes.Add([int][char]$clean[$idx] - 32)
        $idx += 1
      }
    }
  }

  $sum = $codes[0]
  for ($i = 1; $i -lt $codes.Count; $i++) {
    $sum += $codes[$i] * $i
  }
  $codes.Add($sum % 103)
  $codes.Add(106)
  $sb = New-Object System.Text.StringBuilder
  foreach ($c in $codes) {
    [void]$sb.Append($script:Code128Patterns[$c])
  }
  return $sb.ToString()
}

function ConvertTo-CompactColorToken([string]$colorPart, [int]$maxLen) {
  $clean = (($colorPart.ToUpperInvariant()) -replace '[^A-Z0-9]', '')
  if ([string]::IsNullOrEmpty($clean) -or $clean.Length -le $maxLen) { return $clean }
  if ($maxLen -le 1) { return $clean.Substring(0, 1) }

  $known = @(
    @('^TRANGXANH|^TRXANH|^TRXAN|^TRXA', 'TX'),
    @('^TRANGDO|^TRDO', 'TD'),
    @('^TRANGDEN|^TRDEN', 'TDE'),
    @('^TRANGVANG|^TRVA', 'TV'),
    @('^DENDO|^DEDO', 'DD'),
    @('^DENTRANG|^DETR', 'DT'),
    @('^DENVANG|^DEVA', 'DV'),
    @('^XANHDUONG|^XADU', 'XD'),
    @('^XANHDEN|^XADE', 'XDE'),
    @('^XANHLA|^XALA', 'XL'),
    @('^XANHNGOC|^XANGO', 'XN'),
    @('^XANHTRANG|^XATR', 'XT'),
    @('^WHBCOF|^WHBCO', 'WBC'),
    @('^WHBLUE', 'WBL'),
    @('^SOOVKH|^SOOVK', 'SVK'),
    @('^BLGOL', 'BG'),
    @('^GREIGESO|^GRSOO', 'GSO'),
    @('^WHSTGR', 'WSG'),
    @('^WHCAFE', 'WCF')
  )
  foreach ($pair in $known) {
    if ($clean -match $pair[0]) {
      $short = [string]$pair[1]
      if ($short.Length -le $maxLen) { return $short }
      return $short.Substring(0, $maxLen)
    }
  }
  if ($maxLen -eq 2) {
    $mid = [int][Math]::Floor($clean.Length / 2.0)
    return ($clean[0].ToString() + $clean[$mid].ToString())
  }
  return ($clean.Substring(0, $maxLen - 1) + $clean[$clean.Length - 1].ToString())
}

function ConvertTo-CompactBarcode128([string]$rawCode, [int]$maxDots = 200) {
  $clean = ((($rawCode -replace '[^\x20-\x7E]', '').ToUpperInvariant()) -replace '[^A-Z0-9]', '')
  if ([string]::IsNullOrEmpty($clean)) { return "ITEM" }
  if ((ConvertTo-Code128RawPattern $clean).Length -le $maxDots) { return $clean }

  if ($clean -notmatch '^([A-Z])([A-Z]+?)(\d{6})([A-Z0-9]*)$') {
    $trimmed = $clean
    while ($trimmed.Length -gt 8 -and (ConvertTo-Code128RawPattern $trimmed).Length -gt $maxDots) {
      $trimmed = $trimmed.Substring(0, $trimmed.Length - 1)
    }
    return $trimmed
  }

  $cat = $Matches[1]
  $brand = $Matches[2]
  $sixDigits = $Matches[3]
  $suffix = $Matches[4]

  $colorPart = ""
  $sizePart = ""
  if (-not [string]::IsNullOrEmpty($suffix)) {
    if ($suffix -match '^(.*?)(FREESIZE|XXS|XS|2XL|3XL|4XL|XXL|XXXL|XL|[234]\d(?:5)?|[2345]U|S|M|L)$') {
      $colorPart = $Matches[1]
      $sizePart = $Matches[2]
    } else {
      $colorPart = $suffix
    }
  }

  $sizeTokens = if ($sizePart -eq 'FREESIZE') { @('FREESIZE', 'FS') } else { @($sizePart) }
  foreach ($sz in $sizeTokens) {
    if (-not [string]::IsNullOrEmpty($colorPart)) {
      foreach ($cLen in @(3, 2)) {
        $sc = ConvertTo-CompactColorToken $colorPart $cLen
        $cand = "$cat$brand$sixDigits$sc$sz"
        if ((ConvertTo-Code128RawPattern $cand).Length -le $maxDots) {
          return $cand
        }
      }
    }

    $sc2 = ConvertTo-CompactColorToken $colorPart 2
    $startB = [Math]::Min($brand.Length, 5)
    for ($bLen = $startB; $bLen -ge 2; $bLen--) {
      $sb = $brand.Substring(0, $bLen)
      foreach ($cLen in @(3, 2)) {
        $sc = ConvertTo-CompactColorToken $colorPart $cLen
        $cand = "$cat$sb$sixDigits$sc$sz"
        if ((ConvertTo-Code128RawPattern $cand).Length -le $maxDots) {
          return $cand
        }
      }
    }
  }

  $finalSz = if ($sizePart -eq 'FREESIZE') { 'FS' } else { $sizePart }
  $sc1 = ConvertTo-CompactColorToken $colorPart 1
  $sb2 = if ($brand.Length -ge 2) { $brand.Substring(0, 2) } else { $brand }
  return "$cat$sb2$sixDigits$sc1$finalSz"
}

function ConvertTo-Code128Pattern([string]$rawCode, [int]$maxDots = 200) {
  $compact = ConvertTo-CompactBarcode128 $rawCode $maxDots
  $pat = ConvertTo-Code128RawPattern $compact
  if (($pat.Length * 2) -le [Math]::Min($maxDots, 178)) {
    $sb2 = New-Object System.Text.StringBuilder
    for ($i = 0; $i -lt $pat.Length; $i++) {
      [void]$sb2.Append($(if ($pat[$i] -eq '1') { "11" } else { "00" }))
    }
    return $sb2.ToString()
  }
  return $pat
}

function Sync-PrinterPaperSize([string]$printerName, [double]$wMm, [double]$hMm) {
  $wMicrons = [int][Math]::Round($wMm * 1000.0)
  $hMicrons = [int][Math]::Round($hMm * 1000.0)
  $wTenthsMm = [int16][Math]::Round($wMm * 10.0)
  $hTenthsMm = [int16][Math]::Round($hMm * 10.0)

  $patchedDmBytes = $null
  try {
    $patchedDmBytes = [ThermalDriverConfigSync]::GetPatchedDevModeBytes($printerName, $wTenthsMm, $hTenthsMm)
  } catch {}

  try {
    $cfg = Get-PrintConfiguration -PrinterName $printerName -ErrorAction SilentlyContinue
    if ($null -ne $cfg -and $cfg.PrintTicketXML) {
      [xml]$xml = $cfg.PrintTicketXML
      $nsMgr = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
      $nsMgr.AddNamespace('psf', 'http://schemas.microsoft.com/windows/2003/08/printing/printschemaframework')
      $nsMgr.AddNamespace('psk', 'http://schemas.microsoft.com/windows/2003/08/printing/printschemakeywords')

      $mediaSizeNode = $xml.SelectSingleNode("//psf:Feature[@name='psk:PageMediaSize']/psf:Option", $nsMgr)
      if ($null -ne $mediaSizeNode) {
        $mediaSizeNode.SetAttribute('name', 'psk:CustomMediaSize')
        $wNode = $mediaSizeNode.SelectSingleNode("psf:ScoredProperty[@name='psk:MediaSizeWidth']/psf:Value", $nsMgr)
        $hNode = $mediaSizeNode.SelectSingleNode("psf:ScoredProperty[@name='psk:MediaSizeHeight']/psf:Value", $nsMgr)
        if ($null -ne $wNode) { $wNode.InnerText = [string]$wMicrons }
        if ($null -ne $hNode) { $hNode.InnerText = [string]$hMicrons }
      }
      $orientNode = $xml.SelectSingleNode("//psf:Feature[@name='psk:PageOrientation']/psf:Option", $nsMgr)
      if ($null -ne $orientNode) {
        $orientNode.SetAttribute('name', 'psk:Portrait')
      }
      if ($null -ne $patchedDmBytes) {
        $dmNodes = $xml.SelectNodes("//psf:ParameterInit[contains(@name, 'Devmode') or contains(@name, 'DevMode')]/psf:Value", $nsMgr)
        foreach ($dmNode in $dmNodes) {
          $dmNode.InnerText = [Convert]::ToBase64String($patchedDmBytes)
        }
      }
      Set-PrintConfiguration -PrinterName $printerName -PrintTicketXml $xml.OuterXml -ErrorAction SilentlyContinue
    }
  } catch {}

  return $patchedDmBytes
}

function Get-LocalPrintersList {
  $list = @()
  Get-CimInstance -ClassName Win32_Printer | ForEach-Object {
    $name = [string]$_.Name
    $driver = [string]$_.DriverName
    $port = [string]$_.PortName
    $workOffline = [bool]$_.WorkOffline
    $statusNum = [int]$_.PrinterStatus
    $isOnline = (-not $workOffline) -and ($statusNum -eq 3 -or $statusNum -eq 4 -or $statusNum -eq 0)
    $isThermal = Test-IsThermal $name $driver

    $list += [PSCustomObject]@{
      Name = $name
      DriverName = $driver
      PortName = $port
      PrinterStatus = if ($workOffline) { "Offline" } else { "Normal" }
      Default = [bool]$_.Default
      WorkOffline = $workOffline
      IsOnline = [bool]$isOnline
      IsThermal = [bool]$isThermal
    }
  }
  return $list
}

function Get-FittedFontPx($g, [string]$family, [string]$text, [float]$maxPx, [float]$minPx, [int]$maxWidthPx) {
  $px = $maxPx
  while ($px -ge $minPx) {
    $f = New-Object System.Drawing.Font($family, $px, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $sz = $g.MeasureString($text, $f)
    if ($sz.Width -le ($maxWidthPx - 2)) {
      return $f
    }
    $f.Dispose()
    $px = [float]([Math]::Round($px - 1.0, 1))
  }
  return New-Object System.Drawing.Font($family, $minPx, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-SingleSticker($g, $sticker, [int]$cellX, [int]$cellY, [int]$cellW, [int]$cellH, [double]$pxPerMmX, [double]$pxPerMmY) {
  if ($null -eq $sticker) { return }

  $clipRect = New-Object System.Drawing.Rectangle($cellX, $cellY, $cellW, $cellH)
  $g.SetClip($clipRect)

  try {
    $brushBlack = [System.Drawing.Brushes]::Black
    $brushWhite = [System.Drawing.Brushes]::White

    $sfCenter = New-Object System.Drawing.StringFormat
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
    $sfCenter.LineAlignment = [System.Drawing.StringAlignment]::Center
    $sfCenter.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
    $sfCenter.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap

    $sfCode = New-Object System.Drawing.StringFormat
    $sfCode.Alignment = [System.Drawing.StringAlignment]::Center
    $sfCode.LineAlignment = [System.Drawing.StringAlignment]::Center
    $sfCode.Trimming = [System.Drawing.StringTrimming]::None
    $sfCode.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap

    $scaleY = $pxPerMmY / 8.0
    $padX = [Math]::Max(14, [int][Math]::Round(1.8 * $pxPerMmX))
    $innerX = $cellX + $padX
    $innerW = $cellW - ($padX * 2)

    $y = $cellY

    if (-not [string]::IsNullOrWhiteSpace($sticker.shopName)) {
      $shopH = [int][Math]::Round(19 * $scaleY)
      $fontShop = Get-FittedFontPx $g 'Arial' ([string]$sticker.shopName) ([float](19 * $scaleY)) ([float](14 * $scaleY)) $innerW
      $rectShop = New-Object System.Drawing.RectangleF($innerX, $y, $innerW, $shopH)
      $g.DrawString([string]$sticker.shopName, $fontShop, $brushBlack, $rectShop, $sfCenter)
      $fontShop.Dispose()
      $lineH = [Math]::Max(2, [int][Math]::Round(2 * $scaleY))
      $g.FillRectangle($brushBlack, $innerX, $y + $shopH, $innerW, $lineH)
      $y += $shopH + $lineH + 1
    } else {
      $y += [int][Math]::Round(2 * $scaleY)
    }

    if (-not [string]::IsNullOrWhiteSpace($sticker.name)) {
      $customPx = if ($null -ne $sticker.nameFontSizePx) { [float]$sticker.nameFontSizePx } else { 0.0 }
      $wrapName = if ($null -ne $sticker.wrapProductName) { [bool]$sticker.wrapProductName } else { $true }

      if ($customPx -gt 0) {
        $fontName = New-Object System.Drawing.Font('Arial', [float]($customPx * $scaleY), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      } else {
        $fontName = Get-FittedFontPx $g 'Arial' ([string]$sticker.name) ([float](25 * $scaleY)) ([float](13 * $scaleY)) $innerW
      }

      $singleLineSz = $g.MeasureString([string]$sticker.name, $fontName)
      $needsTwoLines = $wrapName -and ($singleLineSz.Width -gt ($innerW + 2))

      if ($needsTwoLines) {
        $sfWrap = New-Object System.Drawing.StringFormat
        $sfWrap.Alignment = [System.Drawing.StringAlignment]::Center
        $sfWrap.LineAlignment = [System.Drawing.StringAlignment]::Center
        $sfWrap.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
        $lineHeightPx = [int][Math]::Ceiling($fontName.GetHeight($g))
        $nameH = [Math]::Min([int][Math]::Round(36 * $scaleY), [Math]::Max([int][Math]::Round(26 * $scaleY), [int][Math]::Round($lineHeightPx * 2.05)))
        $rectName = New-Object System.Drawing.RectangleF($innerX, $y, $innerW, $nameH)
        $g.DrawString([string]$sticker.name, $fontName, $brushBlack, $rectName, $sfWrap)
        $sfWrap.Dispose()
        $y += $nameH + 1
      } else {
        $lineHeightPx = [int][Math]::Ceiling($fontName.GetHeight($g))
        $nameH = [Math]::Max([int][Math]::Round(20 * $scaleY), [Math]::Min([int][Math]::Round(30 * $scaleY), $lineHeightPx + 2))
        $rectName = New-Object System.Drawing.RectangleF($innerX, $y, $innerW, $nameH)
        $g.DrawString([string]$sticker.name, $fontName, $brushBlack, $rectName, $sfCenter)
        $y += $nameH + 1
      }
      $fontName.Dispose()
    } else {
      $y += [int][Math]::Round(2 * $scaleY)
    }

    $hasPrice = -not [string]::IsNullOrWhiteSpace($sticker.priceText)
    $codeH = [int][Math]::Round(16 * $scaleY)
    $priceH = if ($hasPrice) { [int][Math]::Round(24 * $scaleY) } else { [int][Math]::Round(2 * $scaleY) }
    $bottomPad = [int][Math]::Round(3 * $scaleY)

    $barTop = $y
    $availBarH = ($cellY + $cellH) - $barTop - $codeH - $priceH - $bottomPad - 1
    $barHeight = [Math]::Max([int][Math]::Round(28 * $scaleY), $availBarH)
    if (($barTop + $barHeight + $codeH + $priceH + $bottomPad) -gt ($cellY + $cellH)) {
      $barHeight = [Math]::Max([int][Math]::Round(22 * $scaleY), ($cellY + $cellH) - $barTop - $codeH - $priceH - $bottomPad)
    }
    $pattern = [string]$sticker.pattern

    if ($pattern.Length -gt 0) {
      $quietZonePx = [Math]::Max(26, [int][Math]::Round(3.25 * $pxPerMmX))
      $maxBarW = [Math]::Min([int][Math]::Round(26.5 * $pxPerMmX), $cellW - ($quietZonePx * 2))
      $modulePx = [int][Math]::Floor($maxBarW / $pattern.Length)
      if ($modulePx -lt 1) { $modulePx = 1 }
      if ($modulePx -gt 2) { $modulePx = 2 }

      $totalBarPx = $pattern.Length * $modulePx
      $startX = [Math]::Max($cellX + $quietZonePx, $cellX + [int][Math]::Floor(($cellW - $totalBarPx) / 2.0))

      $g.FillRectangle($brushWhite, $cellX, $barTop, $cellW, $barHeight)

      $i = 0
      while ($i -lt $pattern.Length) {
        if ($pattern[$i] -eq '1') {
          $run = 1
          while (($i + $run) -lt $pattern.Length -and $pattern[$i + $run] -eq '1') {
            $run++
          }
          $barX = $startX + ($i * $modulePx)
          $barW = $run * $modulePx
          if (($barX + $barW) -le ($cellX + $cellW - $quietZonePx + 4)) {
            $g.FillRectangle($brushBlack, $barX, $barTop, $barW, $barHeight)
          }
          $i += $run
        } else {
          $i++
        }
      }
    }
    $y = $barTop + $barHeight + 1

    $rawCodeStr = [string]$sticker.code
    $spacedCode = ($rawCodeStr.ToCharArray()) -join ' '
    $fontCode = Get-FittedFontPx $g 'Consolas' $spacedCode ([float](17 * $scaleY)) ([float](11 * $scaleY)) $innerW
    $rectCode = New-Object System.Drawing.RectangleF($innerX, $y, $innerW, $codeH)
    $g.DrawString($spacedCode, $fontCode, $brushBlack, $rectCode, $sfCode)
    $fontCode.Dispose()
    $y += $codeH

    if ($hasPrice) {
      $fontPrice = Get-FittedFontPx $g 'Arial' ([string]$sticker.priceText) ([float](28 * $scaleY)) ([float](18 * $scaleY)) $innerW
      $rectPrice = New-Object System.Drawing.RectangleF($innerX, $y, $innerW, $priceH)
      $g.DrawString([string]$sticker.priceText, $fontPrice, $brushBlack, $rectPrice, $sfCenter)
      $fontPrice.Dispose()
    }

    $sfCenter.Dispose()
    $sfCode.Dispose()
  } finally {
    $g.ResetClip()
  }
}

# 1. Auto-configure all detected thermal printers to 70x20mm 2-column right on startup!
Write-Host "[1/2] Dang quet va tu dong cau hinh Driver may in nhiet 2 cot (70x20mm, Monochrome 203 DPI)..." -ForegroundColor Yellow
$detectedPrinters = Get-LocalPrintersList
foreach ($p in $detectedPrinters) {
  if ($p.IsThermal) {
    [void](Sync-PrinterPaperSize $p.Name 70 20)
    Write-Host ("  -> Da dong bo chuan 2 cot 70x20mm + Tat Halftone cho may in: " + $p.Name + " (" + $p.PortName + ")") -ForegroundColor Green
  } else {
    Write-Host ("  -> Phat hien may in: " + $p.Name + " (" + $p.PortName + ")") -ForegroundColor Gray
  }
}

Write-Host ""
Write-Host "[2/2] Kiem tra cong dich vu In Truc Tiep (Port 4000)..." -ForegroundColor Yellow

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:4000/")
$listener.Prefixes.Add("http://127.0.0.1:4000/")

try {
  $listener.Start()
  Write-Host "  -> DICH VU IN 1-CLICK (2 COT 70x20mm) DA SAN SANG TAI: http://localhost:4000" -ForegroundColor Green
  Write-Host "  -> Hay giu cua so nay mo khi in tem tren trinh duyet!" -ForegroundColor Cyan
  Write-Host ""
} catch {
  Write-Host "  -> Cong 4000 da duoc Server 11Sport su dung (May tinh nay dang chay san Server)." -ForegroundColor Green
  Write-Host "  -> Cau hinh Driver 70x20mm Monochrome da duoc cap nhat thanh cong!" -ForegroundColor Green
  Start-Sleep -Seconds 5
  exit 0
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    $res.Headers.Add("Access-Control-Allow-Origin", "*")
    $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, Access-Control-Request-Private-Network")
    $res.Headers.Add("Access-Control-Allow-Private-Network", "true")

    if ($req.HttpMethod -eq "OPTIONS") {
      $res.StatusCode = 204
      $res.Close()
      continue
    }

    $path = $req.Url.AbsolutePath.ToLowerInvariant()

    if ($req.HttpMethod -eq "GET" -and ($path -eq "/api/v1/system/printers" -or $path -eq "/api/v1/printers" -or $path -eq "/api/printers")) {
      $printers = Get-LocalPrintersList
      $payload = @{
        success = $true
        data = @{
          printers = @($printers)
          platform = "win32"
        }
      } | ConvertTo-Json -Depth 5 -Compress

      $buf = [System.Text.Encoding]::UTF8.GetBytes($payload)
      $res.ContentType = "application/json; charset=utf-8"
      $res.StatusCode = 200
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.Close()
      continue
    }

    if ($req.HttpMethod -eq "POST" -and ($path -eq "/api/v1/system/printers/print-labels" -or $path -eq "/api/v1/printers/print-labels" -or $path -eq "/api/printers")) {
      $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
      $bodyStr = $reader.ReadToEnd()
      $reader.Close()

      $body = $bodyStr | ConvertFrom-Json
      $printerName = [string]$body.printerName
      $syncOnly = [bool]$body.syncOnly
      $shopName = if ($null -ne $body.shopName) { [string]$body.shopName } else { "11SPORT" }
      $wMm = if ($body.paperWidthMm) { [double]$body.paperWidthMm } else { 70.0 }
      $hMm = if ($body.paperHeightMm) { [double]$body.paperHeightMm } else { 20.0 }

      $patchedDmBytes = Sync-PrinterPaperSize $printerName $wMm $hMm

      if ($syncOnly) {
        $respSync = @{
          success = $true
          data = @{ printedLabels = 0; printedPages = 0; printerName = $printerName; syncedDriver = $true }
          message = "Đã đồng bộ khổ giấy 70×20mm cho máy in $printerName"
        } | ConvertTo-Json -Compress
        $bufSync = [System.Text.Encoding]::UTF8.GetBytes($respSync)
        $res.ContentType = "application/json; charset=utf-8"
        $res.StatusCode = 200
        $res.OutputStream.Write($bufSync, 0, $bufSync.Length)
        $res.Close()
        continue
      }

      $showProductName = if ($null -ne $body.options -and $null -ne $body.options.showProductName) { [bool]$body.options.showProductName } else { $true }
      $nameFontSizePx = if ($null -ne $body.options -and $null -ne $body.options.nameFontSizePx) { [float]$body.options.nameFontSizePx } else { 0.0 }
      $wrapProductName = if ($null -ne $body.options -and $null -ne $body.options.wrapProductName) { [bool]$body.options.wrapProductName } else { $true }

      $stickers = @()
      foreach ($it in $body.items) {
        $qty = [int]$it.quantity
        $cleanCode = ConvertTo-CompactBarcode128 ([string]$it.code) 200
        $pat = ConvertTo-Code128Pattern $cleanCode 200
        $displayName = if ($showProductName) { [string]$it.name } else { "" }
        for ($k = 0; $k -lt $qty; $k++) {
          $stickers += [PSCustomObject]@{
            shopName = $shopName
            name = $displayName
            code = $cleanCode
            priceText = [string]$it.priceText
            pattern = $pat
            nameFontSizePx = $nameFontSizePx
            wrapProductName = $wrapProductName
          }
        }
      }

      $rows = @()
      for ($i = 0; $i -lt $stickers.Count; $i += 2) {
        $rightSticker = if (($i + 1) -lt $stickers.Count) { $stickers[$i + 1] } else { $null }
        $rows += [PSCustomObject]@{
          left = $stickers[$i]
          right = $rightSticker
        }
      }

      $wHundredths = [int][Math]::Round($wMm / 25.4 * 100.0)
      $hHundredths = [int][Math]::Round($hMm / 25.4 * 100.0)

      $doc = New-Object System.Drawing.Printing.PrintDocument
      $doc.PrinterSettings.PrinterName = $printerName
      $paperSize = New-Object System.Drawing.Printing.PaperSize('USER', $wHundredths, $hHundredths)
      $paperSize.RawKind = 256

      if ($null -ne $patchedDmBytes) {
        try {
          $hDevMode = [ThermalDriverConfigSync]::AllocHDevModeFromBytes($patchedDmBytes)
          if ($hDevMode -ne [IntPtr]::Zero) {
            $doc.PrinterSettings.SetHdevmode($hDevMode)
            $doc.DefaultPageSettings.SetHdevmode($hDevMode)
          }
        } catch {}
      }

      $doc.DefaultPageSettings.PaperSize = $paperSize
      $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
      $doc.DefaultPageSettings.Landscape = $false
      $doc.DefaultPageSettings.Color = $false
      $doc.OriginAtMargins = $false
      $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController

      $script:rowIdx = 0
      $doc.add_PrintPage({
        param($sender, $e)
        $g = $e.Graphics
        $g.PageUnit = [System.Drawing.GraphicsUnit]::Pixel
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::None
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
        $g.Clear([System.Drawing.Color]::White)

        $dpiX = if ($g.DpiX -gt 0) { [double]$g.DpiX } else { 203.0 }
        $dpiY = if ($g.DpiY -gt 0) { [double]$g.DpiY } else { 203.0 }
        $pxPerMmX = $dpiX / 25.4
        $pxPerMmY = $dpiY / 25.4

        $hmX = 0
        $hmY = 0
        try {
          $hmX = [int][Math]::Round($e.PageSettings.HardMarginX / 100.0 * $dpiX)
          $hmY = [int][Math]::Round($e.PageSettings.HardMarginY / 100.0 * $dpiY)
        } catch {}
        if ($hmX -lt 0) { $hmX = 0 }
        if ($hmX -gt 16) { $hmX = 16 }
        if ($hmY -lt 0) { $hmY = 0 }
        if ($hmY -gt 16) { $hmY = 16 }

        $W = [int][Math]::Round($wMm * $pxPerMmX)
        $H = [int][Math]::Round($hMm * $pxPerMmY)

        $row = $rows[$script:rowIdx]
        $cellW = [int][Math]::Round(34.0 * $pxPerMmX)
        $leftX = 0 - $hmX
        $rightX = ($W - $cellW) - $hmX
        $topY = 0 - $hmY

        Draw-SingleSticker $g $row.left $leftX $topY $cellW $H $pxPerMmX $pxPerMmY
        if ($null -ne $row.right) {
          Draw-SingleSticker $g $row.right $rightX $topY $cellW $H $pxPerMmX $pxPerMmY
        }

        $script:rowIdx++
        $e.HasMorePages = ($script:rowIdx -lt $rows.Count)
      })

      $doc.Print()
      $doc.Dispose()

      Write-Host ("  [OK] Da in " + $stickers.Count + " tem (" + $rows.Count + " hang 70x20mm) ra may in: " + $printerName) -ForegroundColor Green

      $respJson = @{
        success = $true
        data = @{ printedLabels = $stickers.Count; printedPages = $rows.Count; printerName = $printerName }
        message = "Đã in $($stickers.Count) tem ($($rows.Count) hàng 70×20mm) tới máy in $printerName"
      } | ConvertTo-Json -Compress

      $buf = [System.Text.Encoding]::UTF8.GetBytes($respJson)
      $res.ContentType = "application/json; charset=utf-8"
      $res.StatusCode = 200
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.Close()
      continue
    }

    $res.StatusCode = 404
    $res.Close()
  } catch {
    Write-Host ("  [Loi] " + $_.Exception.Message) -ForegroundColor Red
    try { $ctx.Response.StatusCode = 500; $ctx.Response.Close() } catch {}
  }
}
