"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  ScanLine,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Pause,
  Play,
  Camera,
  SwitchCamera,
  Search,
  Info,
} from "lucide-react";
import { apiRequest, ImportItem, ImportReceipt } from "@/lib/api";

/**
 * Bước 4 — Quét Tag kiểm tra thực tế (LIÊN TỤC)
 * - Camera mở sẵn, tự phát hiện khi đưa tag mới vào khung hình và tự chụp → OCR tag → đối chiếu.
 * - Chỉ đối chiếu với danh sách đã OCR ở bước Kiểm hàng: khớp thì tick xác nhận, KHÔNG thêm dòng mới,
 *   KHÔNG đổi số lượng.
 */
interface TagCheckScannerModalProps {
  receiptId: string;
  items: ImportItem[];
  onReceiptUpdate: (receipt: ImportReceipt) => void;
  onClose: () => void;
}

type ResultKind = "match" | "already" | "notfound" | "ambiguous" | "unreadable" | "error";

interface ScanLog {
  id: number;
  kind: ResultKind;
  text: string;
  at: Date;
}

interface Candidate {
  index: number;
  productCode: string;
  productName: string;
  isChecked?: boolean;
}

const SAMPLE_W = 32;
const SAMPLE_H = 24;
const SAMPLE_INTERVAL_MS = 400;
const MOTION_THRESHOLD = 6; // khung hình đứng yên
const NOVELTY_THRESHOLD = 14; // khác đủ nhiều so với lần quét trước => tag mới
const MIN_CONTRAST = 10; // bỏ qua khung hình trơn (che camera, tường trống)
const MAX_IMAGE_DIM = 1280;

function frameDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

function frameContrast(a: Uint8ClampedArray): number {
  let mean = 0;
  for (let i = 0; i < a.length; i++) mean += a[i];
  mean /= a.length;
  let v = 0;
  for (let i = 0; i < a.length; i++) v += (a[i] - mean) ** 2;
  return Math.sqrt(v / a.length);
}

function beep(ok: boolean) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
    osc.onended = () => ctx.close();
  } catch {
    // ignore
  }
  try {
    navigator.vibrate?.(ok ? 80 : [60, 60, 60]);
  } catch {
    // ignore
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
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevSampleRef = useRef<Uint8ClampedArray | null>(null);
  const lastScannedRef = useRef<Uint8ClampedArray | null>(null);
  const stableCountRef = useRef(0);
  const busyRef = useRef(false);
  const logIdRef = useRef(0);

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [autoMode, setAutoMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<ScanLog | null>(null);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [manualQuery, setManualQuery] = useState("");

  const total = items.length;
  const checked = items.filter((i) => i.isChecked && i.isConfirmed).length;
  const allDone = total > 0 && checked === total;
  const percent = total ? Math.round((checked / total) * 100) : 0;

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
        throw new Error("Trình duyệt không hỗ trợ Camera (cần HTTPS). Hãy nhập mã thủ công bên dưới.");
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
      prevSampleRef.current = null;
      lastScannedRef.current = null;
      stableCountRef.current = 0;
      setCameraActive(true);
    } catch (err: any) {
      setCameraActive(false);
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Bạn đã chặn quyền Camera. Cho phép Camera trên thanh địa chỉ, hoặc nhập mã thủ công bên dưới."
          : err?.message || "Không thể mở Camera. Hãy nhập mã thủ công bên dưới."
      );
    }
  }, []);

  useEffect(() => {
    startCamera("environment");
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleSwitchCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

  /* --------------------------- Xử lý kết quả --------------------------- */

  const pushResult = (kind: ResultKind, text: string) => {
    const log: ScanLog = { id: ++logIdRef.current, kind, text, at: new Date() };
    setLastResult(log);
    setLogs((prev) => [log, ...prev].slice(0, 8));
    if (kind === "match") beep(true);
    else if (kind === "notfound" || kind === "error" || kind === "ambiguous") beep(false);
  };

  const callScanCheck = async (body: Record<string, any>) => {
    const res = await apiRequest<any>(`/imports/${receiptId}/scan-check`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const d = res.data || {};
    if (d.receipt) onReceiptUpdate(d.receipt as ImportReceipt);

    if (d.matched) {
      setCandidates([]);
      setHighlightIndex(d.matchedIndex ?? null);
      const name = d.matchedItem?.productName || d.matchedItem?.productCode || "";
      if (d.alreadyChecked) {
        pushResult("already", `Dòng #${(d.matchedIndex ?? 0) + 1} đã kiểm trước đó: ${name}`);
      } else {
        pushResult("match", `✓ Khớp dòng #${(d.matchedIndex ?? 0) + 1}: ${name} — đã tick xác nhận`);
      }
    } else if (d.ambiguous) {
      setCandidates(Array.isArray(d.candidates) ? d.candidates : []);
      pushResult("ambiguous", d.warning || "Tag khớp nhiều dòng, vui lòng chọn đúng dòng.");
    } else {
      setCandidates([]);
      pushResult("notfound", d.warning || "Tag không có trong danh sách kiểm hàng.");
    }
  };

  const scanImage = useCallback(
    async (dataUrl: string) => {
      busyRef.current = true;
      setBusy(true);
      try {
        const ocr = await apiRequest<any>("/imports/ocr-scan", {
          method: "POST",
          body: JSON.stringify({
            mode: "TAG",
            fileBase64: dataUrl.replace(/^data:[^;]+;base64,/, ""),
            mimeType: "image/jpeg",
          }),
        });
        const t = ocr.data || {};
        if (!t.productCode && !t.productName) {
          pushResult("unreadable", "Chưa đọc được tag — đưa tag gần hơn, đủ sáng, giữ yên 1 giây.");
          return;
        }
        await callScanCheck({
          productCode: t.productCode,
          productName: t.productName,
          rawText: t.rawText,
        });
      } catch (err: any) {
        pushResult("error", err?.message || "Quét thất bại, vui lòng thử lại.");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [receiptId]
  );

  const captureFrame = (): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  const sampleFrame = (): Uint8ClampedArray | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    if (!sampleCanvasRef.current) {
      const c = document.createElement("canvas");
      c.width = SAMPLE_W;
      c.height = SAMPLE_H;
      sampleCanvasRef.current = c;
    }
    const ctx = sampleCanvasRef.current.getContext("2d", { willReadFrequently: true } as any) as
      | CanvasRenderingContext2D
      | null;
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
    const rgba = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
    const gray = new Uint8ClampedArray(SAMPLE_W * SAMPLE_H);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
      gray[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
    }
    return gray;
  };

  const handleManualCapture = async () => {
    if (busyRef.current) return;
    const dataUrl = captureFrame();
    if (!dataUrl) {
      pushResult("error", "Camera chưa sẵn sàng.");
      return;
    }
    lastScannedRef.current = sampleFrame();
    await scanImage(dataUrl);
  };

  // Vòng lặp quét liên tục: chờ khung hình đứng yên + khác lần quét trước => tự chụp & kiểm
  useEffect(() => {
    if (!cameraActive || !autoMode || allDone || candidates.length > 0) return;
    const timer = setInterval(() => {
      if (busyRef.current) return;
      const cur = sampleFrame();
      if (!cur) return;
      const prev = prevSampleRef.current;
      prevSampleRef.current = cur;
      if (!prev) return;

      stableCountRef.current = frameDiff(cur, prev) < MOTION_THRESHOLD ? stableCountRef.current + 1 : 0;
      if (stableCountRef.current < 2) return;
      if (frameContrast(cur) < MIN_CONTRAST) return;
      const last = lastScannedRef.current;
      if (last && frameDiff(cur, last) < NOVELTY_THRESHOLD) return;

      const dataUrl = captureFrame();
      if (!dataUrl) return;
      lastScannedRef.current = cur;
      stableCountRef.current = 0;
      scanImage(dataUrl);
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive, autoMode, allDone, candidates.length, scanImage]);

  const handlePickCandidate = async (index: number) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await callScanCheck({ rowIndex: index });
    } catch (err: any) {
      pushResult("error", err?.message || "Không chọn được dòng.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = manualQuery.trim();
    if (!q || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await callScanCheck({ query: q, productName: q });
      setManualQuery("");
    } catch (err: any) {
      pushResult("error", err?.message || "Không kiểm được mã này.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const closeModal = () => {
    stopCamera();
    onClose();
  };

  const resultStyle: Record<ResultKind, string> = {
    match: "bg-emerald-600 text-white",
    already: "bg-sky-600 text-white",
    notfound: "bg-red-600 text-white",
    ambiguous: "bg-amber-500 text-slate-950",
    unreadable: "bg-slate-700 text-white",
    error: "bg-red-700 text-white",
  };

  /* ------------------------------ Render ------------------------------ */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header + tiến trình */}
        <div className="bg-slate-900 text-white px-3 sm:px-5 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ScanLine className="w-5 h-5 text-amber-400 shrink-0" />
              <h3 className="font-bold text-base sm:text-lg truncate">Bước 4: Quét Tag kiểm tra thực tế</h3>
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
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-sm font-extrabold font-mono whitespace-nowrap">
              {checked}/{total} dòng
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Cột camera */}
          <div className="lg:col-span-3 space-y-3">
            <div className="relative w-full bg-black rounded-xl overflow-hidden aspect-[4/3] sm:aspect-video max-h-[50vh]">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`w-full h-full object-cover ${cameraActive ? "" : "hidden"}`}
              />
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 text-sm p-4 text-center gap-2">
                  <Camera className="w-8 h-8" />
                  {cameraError || "Đang mở camera..."}
                </div>
              )}

              {/* Khung ngắm */}
              {cameraActive && (
                <div className="pointer-events-none absolute inset-[12%] border-2 border-dashed border-amber-400/80 rounded-lg" />
              )}

              {/* Trạng thái */}
              {cameraActive && (
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                      busy
                        ? "bg-amber-400 text-slate-950"
                        : autoMode && !allDone
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-slate-700 text-white"
                    }`}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" /> Đang đọc tag...
                      </>
                    ) : autoMode && !allDone ? (
                      "● Đang quét liên tục — đưa tag vào khung"
                    ) : (
                      "Tạm dừng"
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    className="pointer-events-auto w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"
                    title="Đổi camera"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Kết quả gần nhất */}
              {lastResult && (
                <div
                  key={lastResult.id}
                  className={`absolute bottom-2 left-2 right-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold shadow-lg ${
                    resultStyle[lastResult.kind]
                  }`}
                >
                  {lastResult.text}
                </div>
              )}
            </div>

            {/* Điều khiển */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAutoMode((v) => !v)}
                disabled={!cameraActive || allDone}
                className={`min-h-[44px] rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 ${
                  autoMode ? "bg-slate-200 text-slate-900" : "bg-emerald-600 text-white"
                }`}
              >
                {autoMode ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {autoMode ? "Tạm dừng quét" : "Tiếp tục quét"}
              </button>
              <button
                type="button"
                onClick={handleManualCapture}
                disabled={!cameraActive || busy}
                className="min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" /> Chụp & kiểm ngay
              </button>
            </div>

            {/* Nhập tay */}
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  placeholder="Tag mờ? Nhập mã / tên hàng để kiểm..."
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

            {/* Chọn dòng khi trùng */}
            {candidates.length > 0 && (
              <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 space-y-2">
                <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Tag khớp nhiều dòng — chọn đúng dòng (quét tạm dừng):
                </div>
                {candidates.map((c) => (
                  <button
                    key={c.index}
                    type="button"
                    disabled={busy}
                    onClick={() => handlePickCandidate(c.index)}
                    className="w-full text-left px-3 py-2 min-h-[44px] rounded-lg bg-white border border-amber-200 hover:border-amber-500 text-xs"
                  >
                    <span className="font-bold">#{c.index + 1}</span> {c.productName}
                    {c.isChecked && <span className="ml-1 text-emerald-700 font-bold">(đã kiểm)</span>}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCandidates([])}
                  className="text-xs text-slate-600 underline"
                >
                  Bỏ qua, quét tiếp
                </button>
              </div>
            )}

            {/* Lịch sử quét */}
            {logs.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-bold uppercase text-slate-500">Lịch sử quét</div>
                {logs.map((l) => (
                  <div key={l.id} className="text-[11px] flex gap-2 text-slate-700">
                    <span className="font-mono text-slate-400 shrink-0">
                      {l.at.toLocaleTimeString("vi-VN")}
                    </span>
                    <span
                      className={
                        l.kind === "match"
                          ? "text-emerald-700"
                          : l.kind === "notfound" || l.kind === "error"
                          ? "text-red-600"
                          : l.kind === "ambiguous"
                          ? "text-amber-700"
                          : "text-slate-600"
                      }
                    >
                      {l.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cột danh sách cần kiểm */}
          <div className="lg:col-span-2 space-y-2">
            {allDone ? (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" /> Đã kiểm đủ {total}/{total} dòng! Đóng cửa sổ và bấm
                &quot;Hoàn thành Nhập Kho&quot;.
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex gap-1.5">
                <Info className="w-4 h-4 shrink-0 text-slate-500" />
                Giữ tag trong khung ~1 giây, hệ thống tự chụp & đối chiếu. Hàng không có trong danh sách sẽ chỉ
                cảnh báo, không được thêm vào phiếu.
              </div>
            )}
            <div className="text-[11px] font-bold uppercase text-slate-500">
              Danh sách kiểm hàng ({total - checked} dòng chưa kiểm)
            </div>
            <div className="space-y-1.5 max-h-[40vh] lg:max-h-[60vh] overflow-y-auto pr-1">
              {items.map((it, idx) => {
                const done = it.isChecked && it.isConfirmed;
                return (
                  <div
                    key={idx}
                    className={`px-2.5 py-2 rounded-lg border text-xs flex items-start gap-2 transition ${
                      highlightIndex === idx
                        ? "border-emerald-500 ring-2 ring-emerald-300 bg-emerald-50"
                        : done
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                        done ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300"
                      }`}
                    >
                      {done && <CheckCircle2 className="w-3 h-3" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold ${done ? "text-emerald-900" : "text-slate-900"}`}>
                        #{idx + 1} {it.productName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">
                        {it.productCode} · SL {it.expectedQuantity} {it.unit}
                      </div>
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
