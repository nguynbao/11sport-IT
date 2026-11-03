import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";

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
  "11010011100", "1100011101011"
];

const THERMAL_KEYWORDS = [
  "xprinter", "xp-", "365b", "350b", "420b", "470b", "gprinter", "gp-",
  "zebra", "zd", "zt", "godex", "tsc", "bixolon", "pos", "thermal",
  "barcode", "label", "hprt", "rongta", "deli", "zys", "kpos", "apson"
];

function isThermalPrinter(name: string, driverName: string): boolean {
  const combined = `${name} ${driverName}`.toLowerCase();
  return THERMAL_KEYWORDS.some((kw) => combined.includes(kw));
}

function sanitizeAsciiCode128(input: string): string {
  const normalized = (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
  let out = "";
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      out += normalized[i];
    }
  }
  return out || "ITEM";
}

function encodeCode128RawPattern(rawText: string): string {
  const text = sanitizeAsciiCode128(rawText);
  const START_B = 104;
  const START_C = 105;
  const CODE_B = 100;
  const CODE_C = 99;
  const STOP_CODE = 106;

  const countConsecutiveDigits = (str: string, startIdx: number): number => {
    let count = 0;
    while (startIdx + count < str.length) {
      const ch = str.charCodeAt(startIdx + count);
      if (ch >= 48 && ch <= 57) count++;
      else break;
    }
    return count;
  };

  const codes: number[] = [];
  let i = 0;
  const initialDigits = countConsecutiveDigits(text, 0);
  let mode: "B" | "C" = initialDigits >= 4 ? "C" : "B";
  codes.push(mode === "C" ? START_C : START_B);

  while (i < text.length) {
    if (mode === "C") {
      const dCount = countConsecutiveDigits(text, i);
      if (dCount >= 2) {
        codes.push(parseInt(text.slice(i, i + 2), 10));
        i += 2;
      } else {
        codes.push(CODE_B);
        mode = "B";
      }
    } else {
      const dCount = countConsecutiveDigits(text, i);
      if (dCount >= 4) {
        if (dCount % 2 === 1) {
          codes.push(text.charCodeAt(i) - 32);
          i += 1;
        }
        codes.push(CODE_C);
        mode = "C";
      } else {
        codes.push(text.charCodeAt(i) - 32);
        i += 1;
      }
    }
  }

  let checksum = codes[0];
  for (let idx = 1; idx < codes.length; idx++) {
    checksum += codes[idx] * idx;
  }
  codes.push(checksum % 103);
  codes.push(STOP_CODE);
  return codes.map((c) => CODE128_PATTERNS[c] || "").join("");
}

function encodeCode128BPattern(rawText: string, maxDots = 258): string {
  const pat = encodeCode128RawPattern(rawText);
  const numSymbols = Math.floor((pat.length - 2) / 11);
  if (numSymbols <= 0) return pat;

  let symW = Math.floor((maxDots - 4) / numSymbols);
  if (symW > 24) symW = 24;
  if (symW < 16) symW = 11;

  if (symW === 11) {
    return pat;
  }

  let out = "";
  for (let sIdx = 0; sIdx < numSymbols; sIdx++) {
    const symPat = pat.slice(sIdx * 11, sIdx * 11 + 11);
    const m: number[] = [];
    let i = 0;
    while (i < 11) {
      const ch = symPat[i];
      let r = 1;
      while (i + r < 11 && symPat[i + r] === ch) r++;
      m.push(r);
      i += r;
    }

    if (symW === 22) {
      for (let k = 0; k < 6; k++) {
        out += (k % 2 === 0 ? "1" : "0").repeat(m[k] * 2);
      }
      continue;
    }

    const minR: number[] = [];
    const maxR: number[] = [];
    for (let k = 0; k < 6; k++) {
      let lo = 1;
      while (Math.round((lo * 11) / symW) < m[k]) lo++;
      let hi = lo;
      while (Math.round(((hi + 1) * 11) / symW) === m[k]) hi++;
      minR.push(lo);
      maxR.push(hi);
    }

    let bestR: number[] = m.map((v) => Math.max(1, Math.round((v * symW) / 11)));
    let bestCost = 1e9;

    for (let r0 = minR[0]; r0 <= maxR[0]; r0++) {
      for (let r1 = minR[1]; r1 <= maxR[1]; r1++) {
        for (let r2 = minR[2]; r2 <= maxR[2]; r2++) {
          for (let r3 = minR[3]; r3 <= maxR[3]; r3++) {
            for (let r4 = minR[4]; r4 <= maxR[4]; r4++) {
              const r5 = symW - (r0 + r1 + r2 + r3 + r4);
              if (r5 >= minR[5] && r5 <= maxR[5]) {
                const rr = [r0, r1, r2, r3, r4, r5];
                let ok = true;
                for (let k = 0; k < 4; k++) {
                  if (Math.round(((rr[k] + rr[k + 1]) * 11) / symW) !== m[k] + m[k + 1]) {
                    ok = false;
                    break;
                  }
                }
                if (ok) {
                  let cost = 0;
                  for (let k = 0; k < 6; k++) {
                    const diff = (rr[k] * 11) / symW - m[k];
                    cost += diff * diff;
                  }
                  if (cost < bestCost) {
                    bestCost = cost;
                    bestR = rr;
                  }
                }
              }
            }
          }
        }
      }
    }

    for (let k = 0; k < 6; k++) {
      out += (k % 2 === 0 ? "1" : "0").repeat(bestR[k]);
    }
  }

  const finalBarPx = Math.max(2, Math.round((2 * symW) / 11));
  out += "1".repeat(finalBarPx);
  return out;
}

export async function GET() {
  if (process.platform !== "win32") {
    return NextResponse.json({
      success: true,
      data: { printers: [], platform: process.platform }
    });
  }

  const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'

$printers = Get-CimInstance -ClassName Win32_Printer | ForEach-Object {
  $name = [string]$_.Name
  $driver = [string]$_.DriverName
  $port = [string]$_.PortName
  $workOffline = [bool]$_.WorkOffline
  $statusNum = [int]$_.PrinterStatus
  $extStatus = [int]$_.ExtendedPrinterStatus
  $errState = [int]$_.DetectedErrorState

  $statusText = 'Normal'
  if ($workOffline) {
    $statusText = 'Offline'
  } elseif ($statusNum -eq 7 -or $extStatus -eq 7) {
    $statusText = 'Offline'
  } elseif ($errState -eq 4) {
    $statusText = 'OutOfPaper'
  } elseif ($errState -eq 6 -or $errState -eq 9 -or $statusNum -eq 6) {
    $statusText = 'Error'
  }

  $isOnline = (-not $workOffline) -and ($statusText -eq 'Normal' -or $statusNum -eq 3 -or $statusNum -eq 4)

  [PSCustomObject]@{
    Name = $name
    DriverName = $driver
    PortName = $port
    PrinterStatus = $statusText
    Default = [bool]$_.Default
    WorkOffline = $workOffline
    IsOnline = [bool]$isOnline
  }
}

$printers | ConvertTo-Json -Compress
`;

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript],
      { timeout: 10000, maxBuffer: 4 * 1024 * 1024 }
    );

    const raw = (stdout || "").trim();
    const parsed = raw ? JSON.parse(raw) : [];
    const list: any[] = Array.isArray(parsed) ? parsed : [parsed];

    const printers = list
      .filter((p) => p && typeof p.Name === "string")
      .map((p) => ({
        Name: p.Name,
        DriverName: p.DriverName || "",
        PortName: p.PortName || "",
        PrinterStatus: p.PrinterStatus || "Normal",
        Default: Boolean(p.Default),
        WorkOffline: Boolean(p.WorkOffline),
        IsOnline: Boolean(p.IsOnline),
        IsThermal: isThermalPrinter(p.Name, p.DriverName || "")
      }))
      .sort((a, b) => {
        if (a.IsOnline !== b.IsOnline) return a.IsOnline ? -1 : 1;
        if (a.IsThermal !== b.IsThermal) return a.IsThermal ? -1 : 1;
        if (a.Default !== b.Default) return a.Default ? -1 : 1;
        return a.Name.localeCompare(b.Name);
      });

    return NextResponse.json({
      success: true,
      data: { printers, platform: process.platform }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Không thể quét danh sách máy in" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (process.platform !== "win32") {
    return NextResponse.json(
      { success: false, message: "Chỉ hỗ trợ in trực tiếp trên Windows." },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const printerName = String(body?.printerName || "").trim();
    if (!printerName) {
      return NextResponse.json(
        { success: false, message: "Vui lòng chọn máy in tem." },
        { status: 400 }
      );
    }

    const showShopName = body?.options?.showShopName !== false;
    const showProductName = body?.options?.showProductName !== false;
    const showPrice = body?.options?.showPrice !== false;
    const nameFontSizePx = Math.max(0, Math.min(32, Number(body?.options?.nameFontSizePx) || 0));
    const wrapProductName = body?.options?.wrapProductName !== false;
    const shopName = showShopName ? String(body?.shopName ?? "11SPORT").trim() : "";

    // Fixed standard for 2-column 70x20mm thermal roll (2 stickers 35x20mm per row)
    const columns: 1 | 2 = body?.columns === 1 || body?.preset?.columns === 1 ? 1 : 2;
    const paperWidthMm = Math.max(30, Math.min(120, Number(body?.paperWidthMm || body?.preset?.pageWidthMm) || 70));
    const paperHeightMm = Math.max(15, Math.min(120, Number(body?.paperHeightMm || body?.preset?.pageHeightMm) || 20));
    const items = Array.isArray(body?.items) ? body.items : [];

    const expandedStickers: any[] = [];
    for (const item of items) {
      const qty = Math.max(0, Math.min(500, Math.floor(Number(item?.quantity) || 0)));
      if (qty <= 0) continue;
      const cleanCode = sanitizeAsciiCode128(String(item?.code || "ITEM"));
      const pattern = encodeCode128BPattern(cleanCode);
      let priceText = String(item?.priceText || "").trim();
      if (!priceText && showPrice && Number(item?.sellingPrice) > 0) {
        priceText = `${Number(item.sellingPrice).toLocaleString("vi-VN")} đ`;
      }
      const displayName = showProductName ? String(item?.name || "").trim() : "";
      for (let i = 0; i < qty; i++) {
        expandedStickers.push({
          shopName,
          name: displayName,
          code: cleanCode,
          priceText,
          pattern,
          nameFontSizePx,
          wrapProductName
        });
      }
    }

    if (expandedStickers.length === 0) {
      return NextResponse.json(
        { success: false, message: "Không có tem nào có số lượng > 0 để in." },
        { status: 400 }
      );
    }

    const rows: { left: any; right: any | null }[] = [];
    if (columns === 2) {
      for (let i = 0; i < expandedStickers.length; i += 2) {
        rows.push({
          left: expandedStickers[i],
          right: expandedStickers[i + 1] || null
        });
      }
    } else {
      for (let i = 0; i < expandedStickers.length; i++) {
        rows.push({
          left: expandedStickers[i],
          right: null
        });
      }
    }

    const tmpDir = os.tmpdir();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const jsonPath = path.join(tmpDir, `11sport-labels-${stamp}.json`);
    const ps1Path = path.join(tmpDir, `11sport-print-${stamp}.ps1`);

    const psScriptContent = `param([string]$JsonPath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rawJson = [System.IO.File]::ReadAllText($JsonPath, [System.Text.Encoding]::UTF8)
$job = $rawJson | ConvertFrom-Json

Add-Type -AssemblyName System.Drawing

$printerName = [string]$job.printerName
$columns = [int]$job.columns
$wMm = [double]$job.paperWidthMm
$hMm = [double]$job.paperHeightMm
$wHundredths = [int][Math]::Round($wMm / 25.4 * 100.0)
$hHundredths = [int][Math]::Round($hMm / 25.4 * 100.0)
$wMicrons = [int][Math]::Round($wMm * 1000.0)
$hMicrons = [int][Math]::Round($hMm * 1000.0)
$wTenthsMm = [int][Math]::Round($wMm * 10.0)
$hTenthsMm = [int][Math]::Round($hMm * 10.0)

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

$patchedDmBytes = $null
try {
  $patchedDmBytes = [ThermalDriverConfigSync]::GetPatchedDevModeBytes($printerName, [int16]$wTenthsMm, [int16]$hTenthsMm)
} catch {}

try {
  $cfg = Get-PrintConfiguration -PrinterName $printerName -ErrorAction SilentlyContinue
  if ($null -ne $cfg -and $cfg.PrintTicketXML) {
    [xml]$xml = $cfg.PrintTicketXML
    $nsMgr = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
    $nsMgr.AddNamespace('psf', 'http://schemas.microsoft.com/windows/2003/08/printing/printschemaframework')
    $nsMgr.AddNamespace('psk', 'http://schemas.microsoft.com/windows/2003/08/printing/printschemakeywords')
    $nsMgr.AddNamespace('xsi', 'http://www.w3.org/2001/XMLSchema-instance')
    $nsMgr.AddNamespace('xsd', 'http://www.w3.org/2001/XMLSchema')

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

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $printerName

if (-not $doc.PrinterSettings.IsValid) {
  throw "Không tìm thấy máy in '$printerName' trong Windows hoặc driver chưa sẵn sàng."
}

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

$rows = @($job.rows)
$script:rowIndex = 0

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

function Draw-SingleSticker($g, $sticker, [int]$cellX, [int]$cellW, [int]$cellH, [double]$pxPerMmX, [double]$pxPerMmY) {
  if ($null -eq $sticker) { return }

  $brushBlack = [System.Drawing.Brushes]::Black
  $brushWhite = [System.Drawing.Brushes]::White

  $sfCenter = New-Object System.Drawing.StringFormat
  $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
  $sfCenter.LineAlignment = [System.Drawing.StringAlignment]::Center
  $sfCenter.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
  $sfCenter.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap -bor [System.Drawing.StringFormatFlags]::NoClip

  $sfCode = New-Object System.Drawing.StringFormat
  $sfCode.Alignment = [System.Drawing.StringAlignment]::Center
  $sfCode.LineAlignment = [System.Drawing.StringAlignment]::Center
  $sfCode.Trimming = [System.Drawing.StringTrimming]::None
  $sfCode.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap -bor [System.Drawing.StringFormatFlags]::NoClip

  $scaleY = $pxPerMmY / 8.0
  $padX = [Math]::Max(2, [int][Math]::Round(0.4 * $pxPerMmX))
  $innerX = $cellX + $padX
  $innerW = $cellW - ($padX * 2)

  $y = 0

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
  $availBarH = $cellH - $barTop - $codeH - $priceH - $bottomPad - 1
  $barHeight = [Math]::Max([int][Math]::Round(28 * $scaleY), $availBarH)
  if (($barTop + $barHeight + $codeH + $priceH + $bottomPad) -gt $cellH) {
    $barHeight = [Math]::Max([int][Math]::Round(22 * $scaleY), $cellH - $barTop - $codeH - $priceH - $bottomPad)
  }
  $pattern = [string]$sticker.pattern

  if ($pattern.Length -gt 0) {
    $quietZonePx = [Math]::Max(8, [int][Math]::Round(1.0 * $pxPerMmX))
    $maxBarW = $cellW - ($quietZonePx * 2)
    $modulePx = [int][Math]::Floor($maxBarW / $pattern.Length)
    if ($modulePx -lt 1) { $modulePx = 1 }
    if ($modulePx -gt 2) { $modulePx = 2 }

    $totalBarPx = $pattern.Length * $modulePx
    $startX = [Math]::Max($cellX + 2, $cellX + [int][Math]::Floor(($cellW - $totalBarPx) / 2.0))

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
        $g.FillRectangle($brushBlack, $barX, $barTop, $barW, $barHeight)
        $i += $run
      } else {
        $i++
      }
    }
  }
  $y = $barTop + $barHeight + 1

  $rawCodeStr = [string]$sticker.code
  $spacedCode = ($rawCodeStr.ToCharArray()) -join ' '
  $fontCode = Get-FittedFontPx $g 'Consolas' $spacedCode ([float](18 * $scaleY)) ([float](12 * $scaleY)) $innerW
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
}

$doc.add_QueryPageSettings({
  param($sender, $e)
  $e.PageSettings.PaperSize = $paperSize
  $e.PageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
  $e.PageSettings.Landscape = $false
  $e.PageSettings.Color = $false
})

$doc.add_PrintPage({
  param($sender, $e)
  $g = $e.Graphics
  $g.PageUnit = [System.Drawing.GraphicsUnit]::Pixel
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::None
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
  $g.Clear([System.Drawing.Color]::White)

  $dpiX = [double]$g.DpiX
  $dpiY = [double]$g.DpiY
  if ($dpiX -le 0) { $dpiX = 203.0 }
  if ($dpiY -le 0) { $dpiY = 203.0 }

  $pxPerMmX = $dpiX / 25.4
  $pxPerMmY = $dpiY / 25.4

  $W = [int][Math]::Round($wMm * $pxPerMmX)
  $H = [int][Math]::Round($hMm * $pxPerMmY)

  $row = $rows[$script:rowIndex]

  if ($columns -eq 2) {
    $cellW = [int][Math]::Round(34.5 * $pxPerMmX)
    $rightX = $W - $cellW
    Draw-SingleSticker $g $row.left 0 $cellW $H $pxPerMmX $pxPerMmY
    if ($null -ne $row.right) {
      Draw-SingleSticker $g $row.right $rightX $cellW $H $pxPerMmX $pxPerMmY
    }
  } else {
    Draw-SingleSticker $g $row.left 0 $W $H $pxPerMmX $pxPerMmY
  }

  $script:rowIndex++
  if ($script:rowIndex -lt $rows.Count) {
    $e.HasMorePages = $true
  } else {
    $e.HasMorePages = $false
  }
})

$doc.Print()
$doc.Dispose()

Write-Output ("PRINTED_OK:" + $rows.Count)
`;

    try {
      await fs.writeFile(jsonPath, JSON.stringify({
        printerName,
        columns,
        paperWidthMm,
        paperHeightMm,
        rows
      }), "utf8");
      await fs.writeFile(ps1Path, "\uFEFF" + psScriptContent, "utf8");

      const { stdout, stderr } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", ps1Path, "-JsonPath", jsonPath],
        { timeout: 30000, maxBuffer: 4 * 1024 * 1024 }
      );

      const out = (stdout || "").trim();
      if (!out.includes("PRINTED_OK:")) {
        throw new Error(stderr || out || "Không nhận được phản hồi từ Windows Print Spooler.");
      }

      return NextResponse.json({
        success: true,
        data: {
          printedLabels: expandedStickers.length,
          printedPages: rows.length,
          printerName
        },
        message: `Đã in ${expandedStickers.length} tem (${rows.length} hàng 70×20mm) tới máy in "${printerName}"`
      });
    } finally {
      await fs.unlink(jsonPath).catch(() => {});
      await fs.unlink(ps1Path).catch(() => {});
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Lỗi khi gửi lệnh in tới máy in." },
      { status: 400 }
    );
  }
}
