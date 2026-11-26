"use client";

import { Camera, X, Check, ScanLine } from "lucide-react";
import type { ImportItem } from "@/shared/types";
import { useCameraScanner, type CameraScannerModalProps } from "./useCameraScanner";
import CameraViewport from "./CameraViewport";
import ScannedPagesStrip from "./ScannedPagesStrip";
import ScanUploadOptions from "./ScanUploadOptions";
import ScanNotices from "./ScanNotices";
import OcrResultTable from "./OcrResultTable";
import TagScanResult from "./TagScanResult";

export { mergeOcrItemsList } from "./cameraScannerHelpers";

export default function CameraScannerModal(props: CameraScannerModalProps) {
  const { mode, title, existingItemCount = 0, onConfirmOcrItems, onConfirmTagScan, onClose } = props;
  const scanner = useCameraScanner(props);
  const {
    scannedPages, validOcrCount, closeModal, handleStartCaptureMore, scanning, stopCamera, ocrItems, tagQuery, tagActualQty,
  } = scanner;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]">
        {/* Header */}
        <div className="bg-blue-600 text-white px-3 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ScanLine className="w-5 h-5 text-blue-400 shrink-0" />
            <h3 className="font-bold text-base sm:text-lg truncate">
              {title ||
                (mode === "OCR_TABLE"
                  ? "Kiểm hàng: Chụp / Tải nhiều ảnh phiếu giao hàng"
                  : "Quét Tag kiểm hàng thực tế")}
            </h3>
            {mode === "OCR_TABLE" && scannedPages.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-extrabold whitespace-nowrap">
                {scannedPages.length} ảnh · {validOcrCount} dòng
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* ===== Khung Camera / Preview ===== */}
          <CameraViewport scanner={scanner} />

          {/* ===== Dải các ảnh đã quét (khi quét từ 1 ảnh trở lên ở chế độ OCR_TABLE) ===== */}
          {mode === "OCR_TABLE" && scannedPages.length > 0 && <ScannedPagesStrip scanner={scanner} />}

          {/* ===== Tùy chọn tải file (Hỗ trợ chọn NHIỀU ẢNH cùng lúc) ===== */}
          <ScanUploadOptions scanner={scanner} />

          {/* ===== Thông báo ===== */}
          <ScanNotices scanner={scanner} />

          {/* ===== Kết quả ===== */}
          {mode === "OCR_TABLE" ? <OcrResultTable scanner={scanner} /> : <TagScanResult scanner={scanner} />}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-3 sm:px-6 py-3 sm:py-3.5 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 border-t border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm"
            >
              Hủy bỏ
            </button>
            {mode === "OCR_TABLE" && validOcrCount > 0 && (
              <button
                type="button"
                disabled={scanning}
                onClick={handleStartCaptureMore}
                className="min-h-[44px] px-4 py-2.5 rounded-lg border border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-sm flex items-center justify-center gap-1.5"
              >
                <Camera className="w-4 h-4 text-brand-ink" />
                Chụp thêm ảnh (+)
              </button>
            )}
          </div>

          {mode === "OCR_TABLE" ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {existingItemCount > 0 && (
                <button
                  type="button"
                  disabled={validOcrCount === 0 || scanning}
                  onClick={() => {
                    stopCamera();
                    onConfirmOcrItems?.(
                      ocrItems.filter((i) => i.productName.trim() !== ""),
                      "replace"
                    );
                    onClose();
                  }}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold text-xs sm:text-sm"
                  title="Xóa các dòng cũ trên phiếu và thay bằng danh sách vừa quét"
                >
                  Thay thế bảng ({validOcrCount} dòng)
                </button>
              )}
              <button
                type="button"
                disabled={validOcrCount === 0 || scanning}
                onClick={() => {
                  stopCamera();
                  onConfirmOcrItems?.(
                    ocrItems.filter((i) => i.productName.trim() !== ""),
                    existingItemCount > 0 ? "append" : "replace"
                  );
                  onClose();
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow"
              >
                <Check className="w-4 h-4" />
                {existingItemCount > 0
                  ? `Cộng thêm ${validOcrCount} dòng vào phiếu nhập`
                  : `Đưa ${validOcrCount} dòng vào phiếu nhập`}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!tagQuery.trim() || scanning}
              onClick={() => {
                stopCamera();
                onConfirmTagScan?.(tagQuery.trim(), tagActualQty);
                onClose();
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow"
            >
              <Check className="w-4 h-4" />
              Xác nhận đối chiếu Tag
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
