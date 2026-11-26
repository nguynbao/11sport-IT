"use client";

import { Camera, AlertTriangle, Sparkles } from "lucide-react";
import type { CameraScannerState } from "./useCameraScanner";

export default function ScanNotices({ scanner }: { scanner: CameraScannerState }) {
  const { mode, cameraError, scanError, scanInfo, scanning, handleStartCaptureMore, rawText, showRaw, setShowRaw } = scanner;

  return (
    <>
          {cameraError && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {cameraError}
            </div>
          )}
          {scanError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {scanError}
            </div>
          )}
          {scanInfo && (
            <div className="text-xs text-brand-ink bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{scanInfo}</span>
              </div>
              {mode === "OCR_TABLE" && !scanning && (
                <button
                  type="button"
                  onClick={handleStartCaptureMore}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1 shrink-0"
                >
                  <Camera className="w-3.5 h-3.5" /> Chụp thêm ảnh
                </button>
              )}
            </div>
          )}
          {rawText && (
            <div className="text-xs">
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="text-slate-600 underline"
              >
                {showRaw ? "Ẩn" : "Xem"} văn bản gốc đọc được
              </button>
              {showRaw && (
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded p-2 text-[11px] text-slate-700">
                  {rawText}
                </pre>
              )}
            </div>
          )}
    </>
  );
}
