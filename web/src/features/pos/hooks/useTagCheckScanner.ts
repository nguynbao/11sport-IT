"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ImportItem, ImportReceipt } from "@/shared/types";
import { apiRequest, KEEP_ALIVE_INTERVAL_MS, pingServerHealth } from "@/shared/api/client";
import { cleanBarcodeCode, useHardwareBarcodeScanner } from "@/shared/lib/barcodeScanner";
import type { Candidate, Phase, ScanResult } from "../utils/tagCheckTypes";
import {
  AUTO_RETURN_MS,
  CLIENT_SCAN_TIMEOUT_MS,
  buildScanOutcome,
  captureCroppedFrame,
  detectBarcodeFromCanvas,
  expectedOf,
  feedback,
  isFullRow,
  scannedOf,
} from "../utils/tagCheckHelpers";

interface Params {
  receiptId: string;
  items: ImportItem[];
  onReceiptUpdate: (receipt: ImportReceipt) => void;
  onClose: () => void;
}

export function useTagCheckScanner({ receiptId, items, onReceiptUpdate, onClose }: Params) {
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

    const outcome = buildScanOutcome(d, clientDurationMs);
    if (outcome.type === "choose") {
      setCandidates(outcome.candidates);
      setPhase("choose");
      feedback(false);
      return;
    }
    if (typeof outcome.addedIndex === "number") setLastAddedIndex(outcome.addedIndex);
    showResult(outcome.result);
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

  const handleCapture = async () => {
    if (busy || phase !== "live") return;
    const captured = captureCroppedFrame(videoRef.current);
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

  // Phím Space để chụp nhanh (khi không gõ trong ô nhập); phím Enter dành cho súng quét mã vạch
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
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

  useHardwareBarcodeScanner({
    enabled: !busy,
    onScan: (scannedCode) => {
      const cleaned = cleanBarcodeCode(scannedCode) || scannedCode.trim();
      if (!cleaned) return;
      setManualQuery("");
      runRowAction({ query: cleaned, productCode: cleaned, barcode: cleaned });
    },
  });

  const handlePickCandidate = (index: number) => runRowAction({ rowIndex: index });

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = manualQuery.trim();
    if (!raw) return;
    const cleaned = !/\s/.test(raw) ? cleanBarcodeCode(raw) || raw : raw;
    await runRowAction({ query: cleaned, productName: raw, productCode: cleaned, barcode: cleaned });
    setManualQuery("");
  };

  const closeModal = () => {
    stopCamera();
    onClose();
  };

  return {
    videoRef,
    cameraActive,
    cameraError,
    phase,
    processingText,
    elapsedMs,
    frozenUrl,
    result,
    candidates,
    highlightIndex,
    lastAddedIndex,
    manualQuery,
    setManualQuery,
    totalRows,
    fullRows,
    scannedUnits,
    expectedUnits,
    percent,
    allDone,
    busy,
    backToLive,
    handleSwitchCamera,
    handleCapture,
    runRowAction,
    handlePickCandidate,
    handleManualSubmit,
    closeModal,
  };
}

export type TagCheckScannerState = ReturnType<typeof useTagCheckScanner>;
