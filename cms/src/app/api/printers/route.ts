import { NextResponse } from "next/server";
import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

const CODE128_PATTERNS: string[] = [
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
  "11010011100", "1100011101011",
];

function normalizeMasterCode(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function encodeCode128BPattern(rawText: string): string {
  const clean = normalizeMasterCode(rawText) || "SP11SPORT";
  const START_CODE_B = 104;
  const STOP_CODE = 106;
  const codes: number[] = [START_CODE_B];
  let checksum = START_CODE_B;
  for (let i = 0; i < clean.length; i++) {
    const ascii = clean.charCodeAt(i);
    const val = ascii >= 32 && ascii <= 126 ? ascii - 32 : 0;
    codes.push(val);
    checksum += val * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(STOP_CODE);
  return codes.map((c) => CODE128_PATTERNS[c] || "").join("");
}

function isThermalPrinter(name: string, driverName: string, portName: string): boolean {
  const combined = `${name} ${driverName} ${portName}`.toLowerCase();
  if (/pdf|xps|onenote|fax|foxit/i.test(combined)) return false;
  return /xprinter|xp-|tsc|godex|zebra|gprinter|pos|label|barcode|bixolon|hprt|rongta|seagull|usb/i.test(
    combined
  );
}

export async function GET() {
  if (process.platform !== "win32") {
    return NextResponse.json({
      data: { printers: [], recommendedPrinter: null, platform: process.platform },
    });
  }

  try {
    const psCommand = `
      $ErrorActionPreference = 'SilentlyContinue'
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
      $list = Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus, WorkOffline
      if ($null -eq $list) { Write-Output '[]' }
      else { $list | ConvertTo-Json -Compress }
    `;
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", psCommand],
      { timeout: 8000, maxBuffer: 2 * 1024 * 1024 }
    );
    const trimmed = (stdout || "").trim();
    const parsed = trimmed ? JSON.parse(trimmed) : [];
    const rawList = Array.isArray(parsed) ? parsed : [parsed];

    const printers = rawList
      .filter((p) => p && typeof p.Name === "string" && p.Name.trim() !== "")
      .map((p) => {
        const name = String(p.Name).trim();
        const driverName = String(p.DriverName || "").trim();
        const portName = String(p.PortName || "").trim();
        const rawStatus = p.PrinterStatus;
        const statusStr =
          rawStatus === 0 || String(rawStatus).toLowerCase() === "normal"
            ? "Normal"
            : String(rawStatus ?? "Normal");
        const isOnline = !Boolean(p.WorkOffline) && !/offline|error|notavailable/i.test(statusStr);
        const isThermal = isThermalPrinter(name, driverName, portName);
        return { name, driverName, portName, status: statusStr, isOnline, isThermal };
      });

    printers.sort((a, b) => {
      if (a.isThermal !== b.isThermal) return a.isThermal ? -1 : 1;
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const recommendedPrinter =
      printers.find((p) => p.isThermal && p.isOnline)?.name ||
      printers.find((p) => p.isThermal)?.name ||
      printers[0]?.name ||
      null;

    return NextResponse.json({
      data: { printers, recommendedPrinter, platform: process.platform },
    });
  } catch {
    return NextResponse.json({
      data: { printers: [], recommendedPrinter: null, platform: process.platform },
    });
  }
}

export async function POST(request: Request) {
  if (process.platform !== "win32") {
    return NextResponse.json(
      { message: "In trực tiếp qua Windows Spooler chỉ hỗ trợ trên máy Windows." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const printerName = String(body?.printerName || "").trim();
    if (!printerName) {
      return NextResponse.json({ message: "Vui lòng chọn máy in nhiệt." }, { status: 400 });
    }

    const syncOnly = Boolean(body?.syncOnly);
    const columns: 1 | 2 = body?.preset?.columns === 2 ? 2 : 1;
    const widthMm = Math.max(20, Math.min(120, Number(body?.preset?.widthMm) || 50));
    const heightMm = Math.max(15, Math.min(150, Number(body?.preset?.heightMm) || 30));
    const pageWidthMm = Math.max(
      widthMm,
      Math.min(120, Number(body?.preset?.pageWidthMm) || (columns === 2 ? widthMm * 2 + 2 : widthMm))
    );
    const pageHeightMm = Math.max(15, Math.min(150, Number(body?.preset?.pageHeightMm) || heightMm));

    const showShopName = body?.options?.showShopName !== false;
    const showProductName = Boolean(body?.options?.showProductName);
    const showPrice = body?.options?.showPrice !== false;

    const expandedStickers: Array<{
      code: string;
      name: string;
      priceText: string;
      pattern: string;
    }> = [];

    if (!syncOnly) {
      for (const item of body?.items || []) {
        const cleanCode = normalizeMasterCode(item?.code || "");
        const qty = Math.max(0, Math.min(500, Math.round(Number(item?.quantity) || 0)));
        if (!cleanCode || qty <= 0) continue;

        const pattern = encodeCode128BPattern(cleanCode);
        const name = String(item?.name || cleanCode).trim();
        const numPrice = Math.max(0, Math.round(Number(item?.sellingPrice) || 0));
        const priceText = numPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " VND";

        for (let i = 0; i < qty; i++) {
          expandedStickers.push({ code: cleanCode, name, priceText, pattern });
        }
      }

      if (expandedStickers.length === 0) {
        return NextResponse.json({ message: "Không có tem hợp lệ để in." }, { status: 400 });
      }
    }

    const pages: Array<Array<(typeof expandedStickers)[number]>> = [];
    if (!syncOnly) {
      if (columns === 2) {
        for (let i = 0; i < expandedStickers.length; i += 2) {
          const row = [expandedStickers[i]];
          if (expandedStickers[i + 1]) row.push(expandedStickers[i + 1]);
          pages.push(row);
        }
      } else {
        for (const st of expandedStickers) pages.push([st]);
      }
    }

    const tmpId = `11sport-label-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const jsonPath = path.join(os.tmpdir(), `${tmpId}.json`);
    const ps1Path = path.join(os.tmpdir(), `${tmpId}.ps1`);

    const jobData = {
      printerName,
      widthMm,
      heightMm,
      columns,
      pageWidthMm,
      pageHeightMm,
      showShopName,
      showProductName,
      showPrice,
      syncOnly,
      totalStickers: expandedStickers.length,
      pages,
    };

    const psScript = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
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

    [DllImport("winspool.drv", EntryPoint = "SetPrinterDataExW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int SetPrinterDataEx(IntPtr hPrinter, string pKeyName, string pValueName, int Type, byte[] pData, int cbData);

    [DllImport("winspool.drv", EntryPoint = "DocumentPropertiesW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int DocumentProperties(IntPtr hwnd, IntPtr hPrinter, string pDeviceName, IntPtr pDevModeOutput, IntPtr pDevModeInput, int fMode);
}
"@

$jsonRaw = [System.IO.File]::ReadAllText('${jsonPath.replace(/'/g, "''")}', [System.Text.Encoding]::UTF8)
$job = $jsonRaw | ConvertFrom-Json

$pName = [string]$job.printerName
$pWmm = [int][Math]::Round([double]$job.pageWidthMm)
$pHmm = [int][Math]::Round([double]$job.pageHeightMm)

try {
  $pd = New-Object ThermalDriverConfigSync+PRINTER_DEFAULTS
  $pd.DesiredAccess = 0x000F000C
  $hPrinter = [IntPtr]::Zero
  $driverDmBytes = $null
  if ([ThermalDriverConfigSync]::OpenPrinter($pName, [ref]$hPrinter, [ref]$pd)) {
    try {
      $uf = New-Object byte[] 28
      $wUm = [int32]($pWmm * 1000)
      $hUm = [int32]($pHmm * 1000)
      [Array]::Copy([BitConverter]::GetBytes($wUm), 0, $uf, 0, 4)
      [Array]::Copy([BitConverter]::GetBytes($hUm), 0, $uf, 4, 4)
      [Array]::Copy([BitConverter]::GetBytes([int32]0), 0, $uf, 8, 4)
      [Array]::Copy([BitConverter]::GetBytes([int32]0), 0, $uf, 12, 4)
      $uf[24] = 1
      $uf[27] = 1
      [ThermalDriverConfigSync]::SetPrinterDataEx($hPrinter, "PrinterDriverData\\Settings", "User Form: Data", 3, $uf, $uf.Length) | Out-Null

      $dmSize = [ThermalDriverConfigSync]::DocumentProperties([IntPtr]::Zero, $hPrinter, $pName, [IntPtr]::Zero, [IntPtr]::Zero, 0)
      if ($dmSize -gt 0) {
        $ptrDm = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($dmSize)
        try {
          if ([ThermalDriverConfigSync]::DocumentProperties([IntPtr]::Zero, $hPrinter, $pName, $ptrDm, [IntPtr]::Zero, 2) -ge 0) {
            $driverDmBytes = New-Object byte[] $dmSize
            [System.Runtime.InteropServices.Marshal]::Copy($ptrDm, $driverDmBytes, 0, $dmSize)
          }
        } finally {
          [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptrDm)
        }
      }
    } finally {
      [ThermalDriverConfigSync]::ClosePrinter($hPrinter) | Out-Null
    }
  }

  $cfg = Get-PrintConfiguration -PrinterName $pName -ErrorAction SilentlyContinue
  if ($null -ne $cfg -and -not [string]::IsNullOrWhiteSpace($cfg.PrintTicketXML)) {
    [xml]$xml = $cfg.PrintTicketXML
    $b64Node = ($xml.PrintTicket.ParameterInit | Where-Object { $_.name -like "*PageDevmodeSnapshot*" }).Value
    if ($null -ne $b64Node) {
      if ($null -ne $driverDmBytes) {
        $b64Node.'#text' = [Convert]::ToBase64String($driverDmBytes)
      } else {
        $dmBytes = [Convert]::FromBase64String($b64Node.'#text')
        $w10 = [int16]($pWmm * 10)
        $h10 = [int16]($pHmm * 10)
        if ($dmBytes.Length -ge 84) {
          [Array]::Copy([BitConverter]::GetBytes([int16]1), 0, $dmBytes, 76, 2)
          [Array]::Copy([BitConverter]::GetBytes([int16]256), 0, $dmBytes, 78, 2)
          [Array]::Copy([BitConverter]::GetBytes($h10), 0, $dmBytes, 80, 2)
          [Array]::Copy([BitConverter]::GetBytes($w10), 0, $dmBytes, 82, 2)
        }
        $b64Node.'#text' = [Convert]::ToBase64String($dmBytes)
      }
    }
    $mediaFeature = $xml.PrintTicket.Feature | Where-Object { $_.name -eq "psk:PageMediaSize" }
    if ($null -ne $mediaFeature -and $null -ne $mediaFeature.Option) {
      $mediaFeature.Option.ScoredProperty[0].Value.'#text' = [string]($pWmm * 1000)
      $mediaFeature.Option.ScoredProperty[1].Value.'#text' = [string]($pHmm * 1000)
    }
    $orientFeature = $xml.PrintTicket.Feature | Where-Object { $_.name -eq "psk:PageOrientation" }
    if ($null -ne $orientFeature -and $null -ne $orientFeature.Option) {
      $orientFeature.Option.name = "psk:Portrait"
    }
    Set-PrintConfiguration -PrinterName $pName -PrintTicketXml $xml.OuterXml -ErrorAction SilentlyContinue
  }
} catch {
}

if ([bool]$job.syncOnly) {
  Write-Output "SYNCED"
  exit 0
}

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $pName

if (-not $doc.PrinterSettings.IsValid) {
  throw "Không tìm thấy hoặc không thể kết nối tới máy in: $pName"
}

$doc.DocumentName = "11Sport Barcode Labels ($($job.totalStickers) tem)"
$doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController

$pageW100 = [int][Math]::Round(([double]$job.pageWidthMm) * 100.0 / 25.4)
$pageH100 = [int][Math]::Round(([double]$job.pageHeightMm) * 100.0 / 25.4)

$paperSize = New-Object System.Drawing.Printing.PaperSize('USER', $pageW100, $pageH100)
$doc.DefaultPageSettings.PaperSize = $paperSize
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$doc.DefaultPageSettings.Landscape = $false
$doc.OriginAtMargins = $false

$script:pageIndex = 0
$pagesList = @($job.pages)

$doc.add_PrintPage({
  param($sender, $e)
  $g = $e.Graphics
  $g.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

  $currentPage = @($pagesList[$script:pageIndex])
  $stickerW = [double]$job.widthMm
  $stickerH = [double]$job.heightMm
  $pageW = [double]$job.pageWidthMm
  $cols = [int]$job.columns
  $gapMm = if ($cols -eq 2) { [Math]::Max(0.0, ($pageW - ($stickerW * 2.0))) } else { 0.0 }

  $isSmall = ($stickerH -le 24.0)
  $fontShop = New-Object System.Drawing.Font('Arial', [float]$(if ($isSmall) { 6.2 } else { 7.2 }), [System.Drawing.FontStyle]::Bold)
  $fontName = New-Object System.Drawing.Font('Arial', [float]$(if ($isSmall) { 5.8 } else { 6.8 }), [System.Drawing.FontStyle]::Bold)
  $fontCode = New-Object System.Drawing.Font('Courier New', [float]$(if ($isSmall) { 6.8 } else { 8.0 }), [System.Drawing.FontStyle]::Bold)
  $fontPrice = New-Object System.Drawing.Font('Arial', [float]$(if ($isSmall) { 6.2 } else { 7.6 }), [System.Drawing.FontStyle]::Bold)

  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Near
  $sf.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
  $sf.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter

  for ($colIdx = 0; $colIdx -lt $currentPage.Count; $colIdx++) {
    $st = $currentPage[$colIdx]
    if ($null -eq $st) { continue }

    $offsetX = if ($colIdx -eq 0) { 0.0 } else { $stickerW + $gapMm }
    $padX = 1.5
    $innerW = $stickerW - ($padX * 2.0)
    $curY = if ($isSmall) { 1.0 } else { 1.5 }

    if ([bool]$job.showShopName) {
      $rectShop = New-Object System.Drawing.RectangleF([float]($offsetX + $padX), [float]$curY, [float]$innerW, [float]3.2)
      $g.DrawString('11 SPORT', $fontShop, [System.Drawing.Brushes]::Black, $rectShop, $sf)
      $curY += if ($isSmall) { 2.7 } else { 3.2 }
    }

    if ([bool]$job.showProductName -and -not [string]::IsNullOrWhiteSpace([string]$st.name)) {
      $rectName = New-Object System.Drawing.RectangleF([float]($offsetX + $padX), [float]$curY, [float]$innerW, [float]3.2)
      $g.DrawString([string]$st.name, $fontName, [System.Drawing.Brushes]::Black, $rectName, $sf)
      $curY += if ($isSmall) { 2.7 } else { 3.3 }
    }

    $bottomReserve = $(if ($isSmall) { 3.0 } else { 3.6 }) + $(if ([bool]$job.showPrice) { $(if ($isSmall) { 2.8 } else { 3.4 }) } else { 0.5 })
    $barH = [Math]::Max(6.5, ($stickerH - $curY - $bottomReserve))
    $pattern = [string]$st.pattern

    if ($pattern.Length -gt 0) {
      $quietModules = 6
      $totalModules = $pattern.Length + ($quietModules * 2)
      $modW = $innerW / [double]$totalModules
      $barStartX = $offsetX + $padX + ($quietModules * $modW)

      $idx = 0
      while ($idx -lt $pattern.Length) {
        if ($pattern[$idx] -eq '1') {
          $run = 1
          while (($idx + $run -lt $pattern.Length) -and ($pattern[$idx + $run] -eq '1')) {
            $run++
          }
          $bx = [float]($barStartX + ($idx * $modW))
          $bw = [float]($run * $modW)
          $g.FillRectangle([System.Drawing.Brushes]::Black, $bx, [float]$curY, $bw, [float]$barH)
          $idx += $run
        } else {
          $idx++
        }
      }
    }

    $curY += $barH + 0.4

    $rectCode = New-Object System.Drawing.RectangleF([float]($offsetX + 0.5), [float]$curY, [float]($stickerW - 1.0), [float]3.4)
    $g.DrawString([string]$st.code, $fontCode, [System.Drawing.Brushes]::Black, $rectCode, $sf)
    $curY += if ($isSmall) { 2.6 } else { 3.2 }

    if ([bool]$job.showPrice -and -not [string]::IsNullOrWhiteSpace([string]$st.priceText)) {
      $rectPrice = New-Object System.Drawing.RectangleF([float]($offsetX + 0.5), [float]$curY, [float]($stickerW - 1.0), [float]3.4)
      $g.DrawString([string]$st.priceText, $fontPrice, [System.Drawing.Brushes]::Black, $rectPrice, $sf)
    }
  }

  $fontShop.Dispose()
  $fontName.Dispose()
  $fontCode.Dispose()
  $fontPrice.Dispose()
  $sf.Dispose()

  $script:pageIndex++
  $e.HasMorePages = ($script:pageIndex -lt $pagesList.Count)
})

$doc.Print()
$doc.Dispose()
Write-Output "OK"
`;

    try {
      await fs.promises.writeFile(jsonPath, JSON.stringify(jobData), "utf8");
      await fs.promises.writeFile(ps1Path, "\uFEFF" + psScript, "utf8");
      await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", ps1Path],
        { timeout: 25000, maxBuffer: 2 * 1024 * 1024 }
      );
    } finally {
      await fs.promises.unlink(jsonPath).catch(() => undefined);
      await fs.promises.unlink(ps1Path).catch(() => undefined);
    }

    if (syncOnly) {
      return NextResponse.json({
        data: {
          printed: false,
          synced: true,
          printerName,
          pageWidthMm,
          pageHeightMm,
          message: `Đã đồng bộ khổ giấy ${pageWidthMm}×${pageHeightMm}mm cho máy in "${printerName}".`,
        },
      });
    }

    return NextResponse.json({
      data: {
        printed: true,
        synced: true,
        printerName,
        totalStickers: expandedStickers.length,
        totalPages: pages.length,
        message: `Đã gửi lệnh in ${expandedStickers.length} tem (${pages.length} hàng/trang) tới máy in "${printerName}" thành công!`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || "Không thể gửi lệnh in tới máy in nhiệt." },
      { status: 400 }
    );
  }
}
