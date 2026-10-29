"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Camera,
  SwitchCamera,
  Search,
  Undo2,
  Minus,
  Plus,
  HelpCircle,
  Zap,
} from "lucide-react";
import {
  apiRequest,
  ImportItem,
  ImportReceipt,
  KEEP_ALIVE_INTERVAL_MS,
  pingServerHealth,
} from "@/lib/api";

/**
 * Bước 4 — Chụp tag kiểm tra thực tế (ĐẾM TỪNG CHIẾC, TỐI ĐA <= 5 GIÂY)
 * - Mở modal: tự động gửi ping đánh thức server (/health) và duy trì mỗi 8 phút.
 * - Khi bấm chụp:
 *   1) Cắt vùng khung ngắm trung tâm & nén JPEG <= 960px (quality 0.8, ~60-110KB).
 *   2) Dùng BarcodeDetector (nếu trình duyệt hỗ trợ) đọc mã vạch EAN-13/Code-128 trong ~30ms.
 *      Nếu mã vạch đã được ghi nhớ trên dòng hàng -> gửi mỗi mã vạch, khớp tức thì (~0.1s).
 *   3) Gọi 1 request duy nhất POST /imports/:id/scan-tag (gộp OCR + đối chiếu + đếm chiếc, hạn chót <= 5s).
 */
interface TagCheckScannerModalProps {
  receiptId: string;
  items: ImportItem[];
  onReceiptUpdate: (receipt: ImportReceipt) => void;
  onClose: () => void;
}

type Phase = "live" | "processing" | "result" | "choose";
type ResultKind = "added" | "full" | "alreadyFull" | "notfound" | "unreadable" | "error" | "undone";

interface ScanResult {
  kind: ResultKind;
  title: string;
  detail?: string;
  badge?: string;
  rowIndex?: number;
}

interface Candidate {
  index: number;
  productCode: string;
  productName: string;
  scannedQuantity?: number;
  expectedQuantity?: number;
}

const MAX_IMAGE_DIM = 960;
const JPEG_QUALITY = 0.8;
const CLIENT_SCAN_TIMEOUT_MS = 5200; // Hạn chót phía client ~5s
const AUTO_RETURN_MS = 1100; // Tự quay lại camera nhanh sau khi khớp thành công

const scannedOf = (it: ImportItem) => Number(it.scannedQuantity) || 0;
const expectedOf = (it: ImportItem) => Math.max(0, Number(it.expectedQuantity) || 0);
const isFullRow = (it: ImportItem) => scannedOf(it) >= Math.max(1, expectedOf(it));

function feedback(ok: boolean) {
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
async function detectBarcodeFromCanvas(canvas: HTMLCanvasElement): Promise<string> {
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

export default function TagCheckScannerModal({
  receiptId,
  items,
  onReceiptUpdate,
  onClose,
}: TagCheckScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const returnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const [phase, setPhase] = useState<Phase>("live");
  const [processingText, setProcessingText] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [frozenUrl, setFrozenUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [rowBusy, setRowBusy] = useState(false);

  const totalRows = items.length;
  const fullRows = items.filter(isFullRow).length;
  const scannedUnits = items.reduce((s, it) => s + scannedOf(it), 0);
  const expectedUnits = items.reduce((s, it) => s + expectedOf(it), 0);
  const percent = expectedUnits ? Math.min(100, Math.round((scannedUnits / expectedUnits) * 100)) : 0;
  const allDone = totalRows > 0 && fullRows === totalRows;
  const busy = phase === "processing" || rowBusy;

  // Đánh thức server ngay khi mở modal + định kỳ 8 phút chống sleep
  useEffect(() => {
    pingServerHealth();
    const keepAliveTimer = setInterval(pingServerHealth, KEEP_ALIVE_INTERVAL_MS);
    return () => clearInterval(keepAliveTimer);
  }, []);

  // Đồng hồ đếm thời gian xử lý thực tế (hiển thị 0.1s -> 5.0s trên vòng xoay)
  useEffect(() => {
    if (phase !== "processing") {
      setElapsedMs(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 100);
    return () => clearInterval(timer);
  }, [phase]);

  /* ------------------------------ Camera ------------------------------ */

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    setCameraError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Trình duyệt không hỗ trợ Camera (cần HTTPS). Hãy dùng nút +/− hoặc nhập mã bên dưới.");
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraActive(false);
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Bạn đã chặn quyền Camera. Cho phép Camera trên thanh địa chỉ, hoặc dùng nút +/− bên cạnh từng dòng."
          : err?.message || "Không thể mở Camera."
      );
    }
  }, []);

  useEffect(() => {
    startCamera("environment");
    return () => {
      stopCamera();
      if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
    };
  }, [startCamera, stopCamera]);

  const handleSwitchCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

  /* --------------------------- Luồng chụp & kiểm --------------------------- */

  const backToLive = useCallback(() => {
    if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
    returnTimerRef.current = null;
    setPhase("live");
    setFrozenUrl(null);
    setResult(null);
    setCandidates([]);
  }, []);

  const showResult = (r: ScanResult) => {
    setResult(r);
    setPhase("result");
    const ok = r.kind === "added" || r.kind === "full" || r.kind === "undone";
    feedback(ok);
    if (typeof r.rowIndex === "number") setHighlightIndex(r.rowIndex);
    if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
    // Thành công: tự quay lại camera để chụp chiếc tiếp theo. Cảnh báo: chờ người dùng xác nhận.
    if (ok) returnTimerRef.current = setTimeout(backToLive, AUTO_RETURN_MS);
  };

  /** Xử lý dữ liệu phản hồi từ /scan-tag hoặc /scan-check */
  const applyScanResponse = (d: any, clientDurationMs?: number) => {
    if (d.receipt) onReceiptUpdate(d.receipt as ImportReceipt);

    const totalSec = ((d.timing?.totalMs ?? clientDurationMs ?? 0) / 1000).toFixed(1);
    const speedBadge =
      d.source === "barcode"
        ? `⚡ Mã vạch · ${totalSec}s`
        : d.source === "ocr"
        ? `🤖 OCR · ${totalSec}s`
        : undefined;

    if (d.unreadable) {
      showResult({
        kind: "unreadable",
        title: "Không đọc được tag",
        detail: d.warning || "Đưa tag gần hơn, đủ sáng, chụp thẳng và rõ phần mã hàng/size rồi chụp lại.",
        badge: speedBadge,
      });
      return;
    }

    if (d.ambiguous) {
      setCandidates(Array.isArray(d.candidates) ? d.candidates : []);
      setPhase("choose");
      feedback(false);
      return;
    }

    const rowNo = typeof d.matchedIndex === "number" ? d.matchedIndex + 1 : null;
    const name = d.matchedItem?.productName || d.matchedItem?.productCode || "";
    const qty = `${d.scannedQuantity ?? 0}/${d.expectedQuantity ?? 0}`;

    if (!d.matched) {
      showResult({
        kind: "notfound",
        title: "Không có trong danh sách kiểm hàng",
        detail: d.warning || "Hàng này không được thêm vào phiếu. Kiểm tra lại với nhà cung cấp.",
        badge: speedBadge,
      });
    } else if (d.alreadyFull) {
      showResult({
        kind: "alreadyFull",
        title: `Đã đủ số lượng ${qty}`,
        detail: `#${rowNo} ${name} — chiếc này có thể là hàng THỪA, không được cộng thêm.`,
        badge: speedBadge,
        rowIndex: d.matchedIndex,
      });
    } else if (d.undone) {
      showResult({
        kind: "undone",
        title: `Đã hoàn tác — còn ${qty}`,
        detail: `#${rowNo} ${name}`,
        rowIndex: d.matchedIndex,
      });
    } else {
      setLastAddedIndex(d.matchedIndex);
      showResult({
        kind: d.isFull ? "full" : "added",
        title: d.isFull ? `ĐỦ ${qty} — đã tick xác nhận` : `+1 chiếc — ${qty}`,
        detail: `#${rowNo} ${name}`,
        badge: speedBadge,
        rowIndex: d.matchedIndex,
      });
    }
  };

  /** Gọi API đối chiếu nhanh theo dòng hoặc từ khóa nhập tay */
  const runScanCheck = async (body: Record<string, any>) => {
    const started = Date.now();
    const res = await apiRequest<any>(`/imports/${receiptId}/scan-check`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    applyScanResponse(res.data || {}, Date.now() - started);
  };

  /** Cắt vùng khung ngắm trung tâm (84% x 80%) và thu nhỏ tối đa 960px để giảm tải mạng & tăng tốc OCR */
  const captureCroppedFrame = (): { dataUrl: string; canvas: HTMLCanvasElement } | null => {
    const video = videoRef.current;
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
  };

  const handleCapture = async () => {
    if (busy || phase !== "live") return;
    const captured = captureCroppedFrame();
    if (!captured) {
      setCameraError("Camera chưa sẵn sàng, vui lòng đợi 1 giây rồi chụp lại.");
      return;
    }

    const { dataUrl, canvas } = captured;
    setFrozenUrl(dataUrl);
    setPhase("processing");
    setProcessingText("Đang đọc tag & đối chiếu...");

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CLIENT_SCAN_TIMEOUT_MS);

    try {
      // Thử đọc mã vạch ngay trên trình duyệt (~30ms)
      const detectedBarcode = await detectBarcodeFromCanvas(canvas);
      const knownOnReceipt =
        detectedBarcode && items.some((it) => it.barcode && it.barcode === detectedBarcode);

      if (knownOnReceipt) {
        setProcessingText(`Khớp mã vạch ${detectedBarcode}...`);
      }

      const payload: Record<string, any> = knownOnReceipt
        ? { barcode: detectedBarcode }
        : {
            fileBase64: dataUrl.replace(/^data:[^;]+;base64,/, ""),
            mimeType: "image/jpeg",
            ...(detectedBarcode ? { barcode: detectedBarcode } : {}),
          };

      const res = await apiRequest<any>(`/imports/${receiptId}/scan-tag`, {
        method: "POST",
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      applyScanResponse(res.data || {}, Date.now() - startedAt);
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError" || err?.code === "OCR_TIMEOUT";
      showResult({
        kind: isTimeout ? "unreadable" : "error",
        title: isTimeout ? "Quá 5 giây — vui lòng chụp lại" : "Lỗi khi kiểm tra",
        detail: isTimeout
          ? "Giữ tag phẳng, đủ sáng và nằm gọn trong khung ngắm để đọc nhanh dưới 5s."
          : err?.message || "Vui lòng chụp lại.",
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Phím Space / Enter để chụp nhanh (khi không gõ trong ô nhập)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        if (phase === "live") handleCapture();
        else if (phase === "result") backToLive();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const runRowAction = async (body: Record<string, any>) => {
    if (busy) return;
    setRowBusy(true);
    try {
      await runScanCheck(body);
    } catch (err: any) {
      showResult({ kind: "error", title: "Lỗi khi cập nhật", detail: err?.message || "Vui lòng thử lại." });
    } finally {
      setRowBusy(false);
    }
  };

  const handlePickCandidate = (index: number) => runRowAction({ rowIndex: index });

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = manualQuery.trim();
    if (!q) return;
    await runRowAction({ query: q, productName: q, barcode: q });
    setManualQuery("");
  };

  const closeModal = () => {
    stopCamera();
    onClose();
  };

  /* ------------------------------ Render ------------------------------ */

  const resultStyle: Record<ResultKind, { box: string; icon: React.ReactNode }> = {
    added: { box: "bg-emerald-600 text-white", icon: <CheckCircle2 className="w-14 h-14" /> },
    full: { box: "bg-emerald-600 text-white", icon: <CheckCircle2 className="w-14 h-14" /> },
    undone: { box: "bg-sky-600 text-white", icon: <Undo2 className="w-14 h-14" /> },
    alreadyFull: { box: "bg-amber-400 text-slate-950", icon: <AlertTriangle className="w-14 h-14" /> },
    notfound: { box: "bg-red-600 text-white", icon: <XCircle className="w-14 h-14" /> },
    unreadable: { box: "bg-slate-700 text-white", icon: <HelpCircle className="w-14 h-14" /> },
    error: { box: "bg-red-700 text-white", icon: <XCircle className="w-14 h-14" /> },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header + tiến trình */}
        <div className="bg-slate-900 text-white px-3 sm:px-5 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ScanLine className="w-5 h-5 text-amber-400 shrink-0" />
              <h3 className="font-bold text-base sm:text-lg truncate">Bước 4: Chụp tag kiểm tra thực tế</h3>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold">
                <Zap className="w-3 h-3" /> Fast OCR ≤ 5s
              </span>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-xs sm:text-sm font-extrabold font-mono whitespace-nowrap">
              {scannedUnits}/{expectedUnits} chiếc · {fullRows}/{totalRows} dòng đủ
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Cột camera */}
          <div className="lg:col-span-3 space-y-3">
            <div className="relative w-full bg-black rounded-xl overflow-hidden aspect-[4/3] sm:aspect-video max-h-[55vh]">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`w-full h-full object-cover ${cameraActive ? "" : "hidden"}`}
              />
              {/* Ảnh vừa chụp được giữ lại trong lúc xử lý / hiển thị kết quả */}
              {frozenUrl && phase !== "live" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={frozenUrl} alt="Ảnh tag vừa chụp" className="absolute inset-0 w-full h-full object-cover" />
              )}

              {!cameraActive && !frozenUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 text-sm p-4 text-center gap-2">
                  <Camera className="w-8 h-8" />
                  {cameraError || "Đang mở camera..."}
                </div>
              )}

              {/* Khung ngắm + nút chụp */}
              {cameraActive && phase === "live" && (
                <>
                  <div className="pointer-events-none absolute inset-x-[12%] inset-y-[14%] border-2 border-dashed border-amber-400/80 rounded-lg" />
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-black/60 text-white text-[11px] font-bold">
                      Đưa tag (tên + mã vạch + SKU) vào khung rồi bấm chụp (Space)
                    </span>
                    <button
                      type="button"
                      onClick={handleSwitchCamera}
                      className="w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"
                      title="Đổi camera"
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleCapture}
                    disabled={busy}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white/90 border-4 border-amber-400 shadow-lg flex items-center justify-center active:scale-95 transition disabled:opacity-50"
                    title="Chụp & kiểm tra"
                  >
                    <Camera className="w-7 h-7 text-slate-900" />
                  </button>
                </>
              )}

              {/* Vòng loading + bộ đếm giây */}
              {phase === "processing" && (
                <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-3 text-white p-4 text-center">
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-4 border-white/25 border-t-amber-400 animate-spin" />
                    <span className="absolute text-xs font-mono font-extrabold text-amber-300">
                      {(elapsedMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <div className="text-sm font-bold">{processingText}</div>
                  <div className="text-[11px] text-slate-300">Mục tiêu ≤ 5.0s · Tự động dùng model dự phòng nếu chậm</div>
                </div>
              )}

              {/* Kết quả: tick hoặc cảnh báo */}
              {phase === "result" && result && (
                <button
                  type="button"
                  onClick={backToLive}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center p-4"
                  title="Chụp tiếp"
                >
                  <div
                    className={`w-full max-w-sm rounded-2xl px-5 py-5 shadow-2xl flex flex-col items-center text-center gap-2 ${
                      resultStyle[result.kind].box
                    }`}
                  >
                    {resultStyle[result.kind].icon}
                    <div className="text-lg font-extrabold leading-tight">{result.title}</div>
                    {result.detail && <div className="text-xs font-semibold opacity-90">{result.detail}</div>}
                    {result.badge && (
                      <div className="px-2.5 py-0.5 rounded-full bg-black/20 text-[11px] font-mono font-bold">
                        {result.badge}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] font-bold underline opacity-90">
                      {result.kind === "added" || result.kind === "full" || result.kind === "undone"
                        ? "Tự quay lại camera..."
                        : "Chạm để chụp lại / chụp tiếp"}
                    </div>
                  </div>
                </button>
              )}

              {/* Chọn dòng khi trùng nhiều dòng */}
              {phase === "choose" && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-3">
                  <div className="w-full max-w-md bg-white rounded-xl p-3 space-y-2 max-h-full overflow-y-auto">
                    <div className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Tag khớp nhiều dòng — chọn đúng dòng:
                    </div>
                    {candidates.map((c) => {
                      const full =
                        (Number(c.scannedQuantity) || 0) >= Math.max(1, Number(c.expectedQuantity) || 0);
                      return (
                        <button
                          key={c.index}
                          type="button"
                          disabled={busy}
                          onClick={() => handlePickCandidate(c.index)}
                          className="w-full text-left px-3 py-2 min-h-[44px] rounded-lg border border-slate-200 hover:border-amber-500 text-xs"
                        >
                          <span className="font-bold">#{c.index + 1}</span> {c.productName}
                          <span className={`ml-1 font-bold ${full ? "text-emerald-700" : "text-amber-700"}`}>
                            ({c.scannedQuantity ?? 0}/{c.expectedQuantity ?? 0})
                          </span>
                        </button>
                      );
                    })}
                    <button type="button" onClick={backToLive} className="text-xs text-slate-600 underline">
                      Bỏ qua, chụp lại
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hoàn tác + nhập tay */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={busy || lastAddedIndex === null}
                onClick={() => lastAddedIndex !== null && runRowAction({ rowIndex: lastAddedIndex, delta: -1 })}
                className="min-h-[44px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                title="Bỏ 1 chiếc vừa quét nhầm"
              >
                <Undo2 className="w-4 h-4" /> Hoàn tác lần quét
              </button>
              <form onSubmit={handleManualSubmit} className="flex gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={manualQuery}
                    onChange={(e) => setManualQuery(e.target.value)}
                    placeholder="Tag mờ? Nhập mã SKU / mã vạch / tên hàng (+1)..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || !manualQuery.trim()}
                  className="px-4 min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-50"
                >
                  Kiểm
                </button>
              </form>
            </div>
          </div>

          {/* Cột danh sách cần kiểm */}
          <div className="lg:col-span-2 space-y-2">
            {allDone && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" /> Đã kiểm đủ tất cả {totalRows} dòng! Đóng cửa sổ và bấm
                &quot;Hoàn thành Nhập Kho&quot;.
              </div>
            )}
            <div className="text-[11px] font-bold uppercase text-slate-500">
              Danh sách kiểm hàng — còn thiếu {Math.max(0, expectedUnits - scannedUnits)} chiếc
            </div>
            <div className="space-y-1.5 max-h-[40vh] lg:max-h-[62vh] overflow-y-auto pr-1">
              {items.map((it, idx) => {
                const scanned = scannedOf(it);
                const expected = expectedOf(it);
                const full = isFullRow(it);
                const rowPct = expected ? Math.min(100, Math.round((scanned / expected) * 100)) : full ? 100 : 0;
                return (
                  <div
                    key={idx}
                    className={`px-2.5 py-2 rounded-lg border text-xs transition ${
                      highlightIndex === idx
                        ? "border-emerald-500 ring-2 ring-emerald-300 bg-emerald-50"
                        : full
                        ? "border-emerald-200 bg-emerald-50/50"
                        : scanned > 0
                        ? "border-amber-200 bg-amber-50/50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                          full ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 bg-white"
                        }`}
                      >
                        {full && <CheckCircle2 className="w-3 h-3" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`font-semibold break-words whitespace-normal leading-snug ${full ? "text-emerald-900" : "text-slate-900"}`}>
                          #{idx + 1} {it.productName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono break-all whitespace-normal">
                          {it.productCode}
                          {it.barcode ? ` · EAN ${it.barcode}` : ""}
                        </div>
                      </div>
                      <span
                        className={`font-mono font-extrabold whitespace-nowrap ${
                          full ? "text-emerald-700" : scanned > 0 ? "text-amber-700" : "text-slate-500"
                        }`}
                      >
                        {scanned}/{expected}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full ${full ? "bg-emerald-500" : "bg-amber-400"}`}
                          style={{ width: `${rowPct}%` }}
                        />
                      </div>
                      {/* Điều chỉnh tay khi tag hỏng / không đọc được */}
                      <button
                        type="button"
                        disabled={busy || scanned === 0}
                        onClick={() => runRowAction({ rowIndex: idx, delta: -1 })}
                        className="w-8 h-8 rounded-md border border-slate-300 bg-white flex items-center justify-center disabled:opacity-40"
                        title="Bớt 1 chiếc"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy || full}
                        onClick={() => runRowAction({ rowIndex: idx })}
                        className="w-8 h-8 rounded-md border border-slate-300 bg-white flex items-center justify-center disabled:opacity-40"
                        title="Thêm 1 chiếc (khi tag không đọc được)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-3 sm:px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={closeModal}
            className={`w-full sm:w-auto px-6 min-h-[44px] rounded-xl font-extrabold text-sm ${
              allDone ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-200 text-slate-900"
            }`}
          >
            {allDone ? "Xong — Đóng & Hoàn thành nhập kho" : "Đóng (tiếp tục sau)"}
          </button>
        </div>
      </div>
    </div>
  );
}
