import type { ImportItem } from "@/shared/types";
import type { Candidate, ScanResult } from "./tagCheckTypes";

export const MAX_IMAGE_DIM = 960;
export const JPEG_QUALITY = 0.8;
export const CLIENT_SCAN_TIMEOUT_MS = 5200; // Hạn chót phía client ~5s
export const AUTO_RETURN_MS = 1100; // Tự quay lại camera nhanh sau khi khớp thành công

export const scannedOf = (it: ImportItem) => Number(it.scannedQuantity) || 0;
export const expectedOf = (it: ImportItem) => Math.max(0, Number(it.expectedQuantity) || 0);
export const isFullRow = (it: ImportItem) => scannedOf(it) >= Math.max(1, expectedOf(it));

export function feedback(ok: boolean) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = ok ? 880 : 220;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (ok ? 0.12 : 0.35));
      osc.onended = () => ctx.close();
    }
  } catch {
    // ignore
  }
  try {
    navigator.vibrate?.(ok ? 80 : [80, 60, 80]);
  } catch {
    // ignore
  }
}

/** Thử đọc mã vạch trên canvas bằng BarcodeDetector của trình duyệt (nếu có), tối đa 150ms. */
export async function detectBarcodeFromCanvas(canvas: HTMLCanvasElement): Promise<string> {
  try {
    const Detector = typeof window !== "undefined" ? (window as any).BarcodeDetector : undefined;
    if (!Detector) return "";
    const detector = new Detector({
      formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "qr_code"],
    });
    const codes: any[] = await Promise.race([
      detector.detect(canvas),
      new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 150)),
    ]);
    const raw = codes?.[0]?.rawValue;
    return typeof raw === "string" ? raw.trim() : "";
  } catch {
    return "";
  }
}

/** Cắt vùng khung ngắm trung tâm (84% x 80%) và thu nhỏ tối đa 960px để giảm tải mạng & tăng tốc OCR */
export function captureCroppedFrame(
  video: HTMLVideoElement | null
): { dataUrl: string; canvas: HTMLCanvasElement } | null {
  if (!video || !video.videoWidth || !video.videoHeight) return null;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sx = Math.round(vw * 0.08);
  const sy = Math.round(vh * 0.1);
  const sw = Math.round(vw * 0.84);
  const sh = Math.round(vh * 0.8);

  const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
    canvas,
  };
}

export type ScanOutcome =
  | { type: "result"; result: ScanResult; addedIndex?: number }
  | { type: "choose"; candidates: Candidate[] };

/** Chuyển phản hồi /scan-tag hoặc /scan-check thành kết quả hiển thị (hàm thuần) */
export function buildScanOutcome(d: any, clientDurationMs?: number): ScanOutcome {
  const totalSec = ((d.timing?.totalMs ?? clientDurationMs ?? 0) / 1000).toFixed(1);
  const speedBadge =
    d.source === "barcode"
      ? `⚡ Mã vạch · ${totalSec}s`
      : d.source === "ocr"
      ? `🤖 OCR · ${totalSec}s`
      : undefined;

  if (d.unreadable) {
    return {
      type: "result",
      result: {
        kind: "unreadable",
        title: "Không đọc được tag",
        detail: d.warning || "Đưa tag gần hơn, đủ sáng, chụp thẳng và rõ phần mã hàng/size rồi chụp lại.",
        badge: speedBadge,
      },
    };
  }

  if (d.ambiguous) {
    return { type: "choose", candidates: Array.isArray(d.candidates) ? d.candidates : [] };
  }

  const rowNo = typeof d.matchedIndex === "number" ? d.matchedIndex + 1 : null;
  const name = d.matchedItem?.productName || d.matchedItem?.productCode || "";
  const qty = `${d.scannedQuantity ?? 0}/${d.expectedQuantity ?? 0}`;

  if (!d.matched) {
    return {
      type: "result",
      result: {
        kind: "notfound",
        title: "Không có trong danh sách kiểm hàng",
        detail: d.warning || "Hàng này không được thêm vào phiếu. Kiểm tra lại với nhà cung cấp.",
        badge: speedBadge,
      },
    };
  }
  if (d.alreadyFull) {
    return {
      type: "result",
      result: {
        kind: "alreadyFull",
        title: `Đã đủ số lượng ${qty}`,
        detail: `#${rowNo} ${name} — chiếc này có thể là hàng THỪA, không được cộng thêm.`,
        badge: speedBadge,
        rowIndex: d.matchedIndex,
      },
    };
  }
  if (d.undone) {
    return {
      type: "result",
      result: {
        kind: "undone",
        title: `Đã hoàn tác — còn ${qty}`,
        detail: `#${rowNo} ${name}`,
        rowIndex: d.matchedIndex,
      },
    };
  }
  return {
    type: "result",
    addedIndex: d.matchedIndex,
    result: {
      kind: d.isFull ? "full" : "added",
      title: d.isFull ? `ĐỦ ${qty} — đã tick xác nhận` : `+1 chiếc — ${qty}`,
      detail: `#${rowNo} ${name}`,
      badge: speedBadge,
      rowIndex: d.matchedIndex,
    },
  };
}
