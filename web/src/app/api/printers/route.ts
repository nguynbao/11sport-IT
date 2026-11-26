import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  encodeCode128BPattern,
  sanitizeAsciiCode128,
  toCompactBarcode128,
} from "./code128";
import {
  isThermalPrinter,
  LIST_PRINTERS_PS_SCRIPT,
  PRINT_LABELS_PS_SCRIPT,
} from "./windowsPsScripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

export async function GET() {
  if (process.platform !== "win32") {
    return NextResponse.json({
      success: true,
      data: { printers: [], platform: process.platform },
    });
  }

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", LIST_PRINTERS_PS_SCRIPT],
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
        IsThermal: isThermalPrinter(p.Name, p.DriverName || ""),
      }))
      .sort((a, b) => {
        if (a.IsOnline !== b.IsOnline) return a.IsOnline ? -1 : 1;
        if (a.IsThermal !== b.IsThermal) return a.IsThermal ? -1 : 1;
        if (a.Default !== b.Default) return a.Default ? -1 : 1;
        return a.Name.localeCompare(b.Name);
      });

    return NextResponse.json({
      success: true,
      data: { printers, platform: process.platform },
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

    const syncOnly = Boolean(body?.syncOnly);
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
    if (!syncOnly) {
      for (const item of items) {
        const qty = Math.max(0, Math.min(500, Math.floor(Number(item?.quantity) || 0)));
        if (qty <= 0) continue;
        const cleanCode = toCompactBarcode128(sanitizeAsciiCode128(String(item?.code || "ITEM")), 200);
        const pattern = encodeCode128BPattern(cleanCode, 200);
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
            wrapProductName,
          });
        }
      }

      if (expandedStickers.length === 0) {
        return NextResponse.json(
          { success: false, message: "Không có tem nào có số lượng > 0 để in." },
          { status: 400 }
        );
      }
    }

    const rows: { left: any; right: any | null }[] = [];
    if (columns === 2) {
      for (let i = 0; i < expandedStickers.length; i += 2) {
        rows.push({
          left: expandedStickers[i],
          right: expandedStickers[i + 1] || null,
        });
      }
    } else {
      for (let i = 0; i < expandedStickers.length; i++) {
        rows.push({
          left: expandedStickers[i],
          right: null,
        });
      }
    }

    const tmpDir = os.tmpdir();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const jsonPath = path.join(tmpDir, `11sport-labels-${stamp}.json`);
    const ps1Path = path.join(tmpDir, `11sport-print-${stamp}.ps1`);

    try {
      await fs.writeFile(
        jsonPath,
        JSON.stringify({
          printerName,
          syncOnly,
          columns,
          paperWidthMm,
          paperHeightMm,
          rows,
        }),
        "utf8"
      );
      await fs.writeFile(ps1Path, "\uFEFF" + PRINT_LABELS_PS_SCRIPT, "utf8");

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
          printerName,
          syncedDriver: true,
        },
        message: syncOnly
          ? `Đã đồng bộ khổ giấy ${paperWidthMm}×${paperHeightMm}mm cho máy in "${printerName}"`
          : `Đã in ${expandedStickers.length} tem (${rows.length} hàng 70×20mm) tới máy in "${printerName}"`,
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
