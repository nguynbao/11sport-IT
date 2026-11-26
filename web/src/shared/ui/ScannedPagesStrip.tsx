"use client";

import { Camera, Plus, FileText } from "lucide-react";
import type { CameraScannerState } from "./useCameraScanner";

export default function ScannedPagesStrip({ scanner }: { scanner: CameraScannerState }) {
  const { mode, scannedPages, validOcrCount, scanning, handleStartCaptureMore, setScanTarget, imageInputRef, activePageId, handleSelectScannedPage } = scanner;

  return (
    <>
          {mode === "OCR_TABLE" && scannedPages.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-700">
                  Các ảnh / trang đã quét ({scannedPages.length} ảnh → tổng {validOcrCount} dòng hàng):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={scanning}
                    onClick={handleStartCaptureMore}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" /> + Chụp thêm
                  </button>
                  <button
                    type="button"
                    disabled={scanning}
                    onClick={() => {
                      setScanTarget("append");
                      imageInputRef.current?.click();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Thêm nhiều ảnh
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {scannedPages.map((p, idx) => {
                  const isSelected = activePageId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectScannedPage(p)}
                      className={`shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-xs transition ${
                        isSelected
                          ? "border-blue-600 bg-blue-50 text-blue-950 font-bold"
                          : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      {p.kind === "image" && p.dataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.dataUrl}
                          alt={p.name}
                          className="w-9 h-9 rounded object-cover border border-slate-200"
                        />
                      ) : (
                        <FileText className="w-6 h-6 text-slate-500" />
                      )}
                      <div>
                        <div className="truncate max-w-[130px]">
                          #{idx + 1} {p.name}
                        </div>
                        <div className="text-[10px] text-brand-ink font-semibold">
                          +{p.items.length} dòng
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
    </>
  );
}
