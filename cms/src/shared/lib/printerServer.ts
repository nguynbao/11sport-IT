import { execFile } from "child_process";
import { promisify } from "util";
import { isThermalPrinter } from "./printerCode128";
export { postPrintersResponsePayload } from "./printerPrintLabels";

const execFileAsync = promisify(execFile);

function jsonResult(body: any, init?: { status?: number }) {
  return { status: init?.status ?? 200, body };
}

export async function getPrintersResponsePayload() {
  if (process.platform !== "win32") {
    return jsonResult({
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

    return jsonResult({
      success: true,
      data: { printers, platform: process.platform }
    });
  } catch (error: any) {
    return jsonResult(
      { success: false, message: error?.message || "Không thể quét danh sách máy in" },
      { status: 500 }
    );
  }
}

